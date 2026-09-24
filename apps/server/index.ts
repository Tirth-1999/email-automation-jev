import "dotenv/config";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, resolve } from "node:path";
import {
  LABEL_CATEGORIES,
  selectAdditionalSample,
  type LabelingEmail,
} from "../../lib/labeling-sample.js";
import {
  readAllActiveEmails,
  readJson,
  toReviewEmail,
  writePrivateJson,
  type LabeledStore,
  type ReviewBatch,
  type ReviewPool,
} from "../../lib/labeling-store.js";
import { createDatabaseClient, ensureGmailAccount } from "../../lib/repository.js";
import { CLASSIFIER_VERSION, JEV_CATEGORIES } from "../../lib/jev-classifier.js";
import { loadIngestionConfig } from "../../lib/config.js";
import { createGmailClient, getGmailProfile } from "../../lib/gmail.js";
import { GmailRequestController } from "../../lib/gmail-rate-limit.js";
import { runIngestion } from "../../lib/ingest.js";
import { GmailIngestionOrchestrator } from "../../lib/pipeline-orchestrator.js";
import {
  createProductionClassificationRun,
  previewClassificationSelection,
  RUN_SCOPES,
  runClassification,
  validateClassificationConfig,
  type ClassificationWorkerConfig,
  type RunScope,
} from "../../lib/classification-worker.js";
import {
  createClassificationRun,
  enqueueClassificationEmails,
  getClassificationRun,
  listRecentClassificationRuns,
  requestClassificationCancellation,
} from "../../lib/classification-repository.js";
import {
  runBattleground,
  summarizeBattlegroundDecisions,
  validateBattlegroundConfig,
  type BattlegroundConfig,
  type BattlegroundDecisionSummary,
  type BattlegroundReport,
} from "../../lib/battleground.js";
import {
  DEFAULT_REPLY_PROFILE,
  generateReplyWithOpenAI,
  isReplyDraftEligible,
  streamReplyWithOpenAI,
  type ReplyContext,
} from "../../lib/reply-drafter.js";
import {
  buildLlmReviewPayload,
  reviewEmailWithOpenAI,
  shouldRequestLlmReview,
  type LlmReviewInput,
} from "../../lib/llm-reviewer.js";
import {
  benchmarkForAnalytics,
  buildAnalyticsSnapshot,
  type AnalyticsEmailRow,
  type RunTokenRow,
} from "../../lib/analytics.js";
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
} from "../../lib/application-grouping.js";
import {
  materializeApplications,
  type ApplicationMaterializationResult,
} from "../../lib/application-materializer.js";
import { createSnapshotCache } from "../../lib/snapshot-cache.js";
import {
  buildApplicationBoardSnapshot,
  type ApplicationBoardSnapshot,
} from "../../lib/application-board-cache.js";
import {
  answerConversationWithOpenAI,
  answerSqlResultWithOpenAI,
  aiChatSqlFailureMessage,
  generateSqlWithOpenAI,
  isRepairableSqlExecutionError,
  repairSqlWithOpenAI,
} from "../../lib/nl-sql-chat.js";
import {
  routeAiChatMessage,
  type AiChatHistoryMessage,
} from "../../lib/ai-chat-router.js";
import { buildGmailDeepLink } from "../../lib/gmail-deep-link.js";

const port = Number.parseInt(process.env.LABELING_UI_PORT || "4173", 10);
const projectRoot = process.cwd();
const uiRoot = resolve(projectRoot, "apps/dashboard");
const poolPath = resolve(projectRoot, "data/labeling/generated/email-review-pool.json");
const labelsPath = resolve(projectRoot, "data/labeling/generated/labeled-emails.json");
const benchmarkPath = resolve(
  projectRoot,
  "data/labeling/generated/jev-evaluation-results.json",
);
const allLabeledBenchmarkPath = resolve(
  projectRoot,
  "data/labeling/generated/jev-all-labeled-results.json",
);
const evaluationPath = resolve(
  projectRoot,
  "data/labeling/generated/jev-evaluation.json",
);
const battlegroundPath = resolve(
  projectRoot,
  "data/labeling/generated/battleground-latest.json",
);

const routes = new Map<string, string>([
  ["/", resolve(uiRoot, "index.html")],
  ["/index.html", resolve(uiRoot, "index.html")],
  ["/src/styles.css", resolve(uiRoot, "src/styles.css")],
  ["/src/app.js", resolve(uiRoot, "src/app.js")],
  ["/vendor/d3.min.js", resolve(projectRoot, "node_modules/d3/dist/d3.min.js")],
  ["/vendor/d3-sankey.min.js", resolve(projectRoot, "node_modules/d3-sankey/dist/d3-sankey.min.js")],
  ["/sample.json", poolPath],
]);

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

await access(poolPath).catch(() => {
  throw new Error("Missing email-review-pool.json. Run `npm run sample:emails` first.");
});

const database = createDatabaseClient(
  required("SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
);
let emailCache: LabelingEmail[] | null = null;
let mutationQueue: Promise<unknown> = Promise.resolve();
const activeClassificationRuns = new Map<string, Promise<void>>();
let activeBattleground: Promise<void> | null = null;
let battlegroundReport: BattlegroundReport | null = null;
const gmailIngestion = new GmailIngestionOrchestrator();
type OutputRefreshStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
interface OutputRefreshJob {
  status: OutputRefreshStatus;
  stage: string;
  progress_percent: number;
  source_run_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  result: ApplicationMaterializationResult | null;
  error: string | null;
  cancellation_requested_at: string | null;
}
let outputRefresh: OutputRefreshJob | null = null;
let activeOutputRefresh: Promise<void> | null = null;
type ManualPipelineStage = "queued" | "ingestion" | "classification" | "publication" | "complete" | "failed" | "cancelled";
interface ManualPipelineJob {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  stage: ManualPipelineStage;
  classification_run_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  cancellation_requested_at: string | null;
}
let manualPipeline: ManualPipelineJob | null = null;
let activeManualPipeline: Promise<void> | null = null;
type AnalyticsRange = "30" | "60" | "90" | "all";
const analyticsRanges: AnalyticsRange[] = ["30", "60", "90", "all"];
const analyticsSnapshotCache = createSnapshotCache(process.env.REDIS_URL?.trim() || "");
let analyticsMaterializationInFlight: Promise<void> | null = null;
const analyticsCacheKey = (range: AnalyticsRange) => `email-automation:analytics:v4:${range}`;
const applicationBoardCacheKey = "email-automation:application-board:v2";
const commandCenterCacheKey = "email-automation:command-center:v2";
const aiReviewCacheKey = "email-automation:ai-review-queue:v2";
let applicationBoardMaterializationInFlight: Promise<ApplicationBoardSnapshot> | null = null;

function invalidateReadCaches(): void {
  analyticsSnapshotCache.clearMemory();
  void analyticsSnapshotCache.delete([
    ...analyticsRanges.map(analyticsCacheKey),
    applicationBoardCacheKey,
    commandCenterCacheKey,
    aiReviewCacheKey,
  ]);
}

async function cachedAnalyticsSnapshot(range: AnalyticsRange): Promise<unknown> {
  const cached = await analyticsSnapshotCache.get<unknown>(analyticsCacheKey(range));
  if (cached) return cached;
  if (!analyticsMaterializationInFlight) {
    analyticsMaterializationInFlight = materializeAnalyticsSnapshots()
      .finally(() => { analyticsMaterializationInFlight = null; });
  }
  await analyticsMaterializationInFlight;
  const materialized = await analyticsSnapshotCache.get<unknown>(analyticsCacheKey(range));
  if (!materialized) throw new Error(`Analytics snapshot ${range} was not materialized`);
  return materialized;
}

async function refreshAnalyticsSnapshots(): Promise<void> {
  await analyticsSnapshotCache.delete(analyticsRanges.map(analyticsCacheKey));
  analyticsSnapshotCache.clearMemory();
  if (!analyticsMaterializationInFlight) {
    analyticsMaterializationInFlight = materializeAnalyticsSnapshots()
      .finally(() => { analyticsMaterializationInFlight = null; });
  }
  await analyticsMaterializationInFlight;
}

async function cachedApplicationBoardSnapshot(): Promise<ApplicationBoardSnapshot> {
  const cached = await analyticsSnapshotCache.get<ApplicationBoardSnapshot>(applicationBoardCacheKey);
  if (cached) return cached;
  if (!applicationBoardMaterializationInFlight) {
    applicationBoardMaterializationInFlight = materializeApplicationBoardSnapshot()
      .finally(() => { applicationBoardMaterializationInFlight = null; });
  }
  return applicationBoardMaterializationInFlight;
}

async function refreshApplicationBoardSnapshot(): Promise<void> {
  await analyticsSnapshotCache.delete([applicationBoardCacheKey]);
  if (!applicationBoardMaterializationInFlight) {
    applicationBoardMaterializationInFlight = materializeApplicationBoardSnapshot()
      .finally(() => { applicationBoardMaterializationInFlight = null; });
  }
  await applicationBoardMaterializationInFlight;
}

async function updateCachedApplicationStar(applicationId: string, starred: boolean, starredAt: string | null): Promise<void> {
  const snapshot = await cachedApplicationBoardSnapshot();
  let matched: Record<string, unknown> | null = null;
  for (const applications of Object.values(snapshot.by_status)) {
    const application = applications.find((candidate) => candidate.id === applicationId);
    if (!application) continue;
    application.is_starred = starred;
    application.starred_at = starredAt;
    matched = application;
    break;
  }
  snapshot.starred = snapshot.starred.filter((application) => application.id !== applicationId);
  if (starred && matched) snapshot.starred.unshift(matched);
  snapshot.generated_at = new Date().toISOString();
  await analyticsSnapshotCache.set(applicationBoardCacheKey, snapshot, 86_400);
}

async function updateCachedInterviewProgress(
  applicationId: string,
  progress: string | null,
  updatedAt: string | null,
): Promise<void> {
  const snapshot = await cachedApplicationBoardSnapshot();
  const visited = new Set<Record<string, unknown>>();
  for (const application of [...Object.values(snapshot.by_status).flat(), ...snapshot.starred]) {
    if (visited.has(application) || application.id !== applicationId) continue;
    visited.add(application);
    application.interview_progress = progress;
    application.interview_progress_updated_at = updatedAt;
  }
  snapshot.generated_at = new Date().toISOString();
  await analyticsSnapshotCache.set(applicationBoardCacheKey, snapshot, 86_400);
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(`${JSON.stringify(value)}\n`);
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error("Request body is too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

async function labelsStore(): Promise<LabeledStore> {
  const exists = await access(labelsPath).then(
    () => true,
    () => false,
  );
  if (exists) {
    const store = await readJson<LabeledStore>(labelsPath);
    return { ...store, categories: [...LABEL_CATEGORIES] };
  }
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    categories: [...LABEL_CATEGORIES],
    emails: [],
  };
}

function serializeMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function primaryAccountId(): Promise<string> {
  const { data, error } = await database
    .from("gmail_accounts")
    .select("id")
    .order("created_at")
    .limit(1);
  if (error) throw new Error(`Could not load Gmail account: ${error.message}`);
  const account = (data || [])[0] as { id: string } | undefined;
  if (!account) throw new Error("No Gmail account is registered. Run ingestion first.");
  return account.id;
}

interface AiChatConversationRow {
  id: string;
  gmail_account_id: string;
  title: string;
  messages: AiChatMessageRow[];
  archived_at: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

interface AiChatMessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  route: "sql" | "conversation" | "unsupported" | null;
  route_confidence: number | null;
  model: string | null;
  tool_used: boolean;
  generated_sql: string | null;
  row_count: number;
  created_at: string;
}

function aiChatStorageError(action: string, message: string): Error {
  return new Error(`${action}. Apply migration 013 first. ${message}`);
}

function aiChatTitle(question: string): string {
  const compact = question.replace(/\s+/g, " ").trim();
  if (!compact) return "New chat";
  return compact.length > 56 ? `${compact.slice(0, 53).trimEnd()}…` : compact;
}

async function createAiChatConversation(accountId: string): Promise<AiChatConversationRow> {
  const { data, error } = await database
    .from("ai_chat_conversations")
    .insert({ gmail_account_id: accountId, title: "New chat" })
    .select("id,gmail_account_id,title,messages,archived_at,last_message_at,created_at,updated_at")
    .single();
  if (error) throw aiChatStorageError("Could not create AI chat", error.message);
  return data as AiChatConversationRow;
}

async function getAiChatConversation(accountId: string, conversationId: string): Promise<AiChatConversationRow | null> {
  const { data, error } = await database
    .from("ai_chat_conversations")
    .select("id,gmail_account_id,title,messages,archived_at,last_message_at,created_at,updated_at")
    .eq("id", conversationId)
    .eq("gmail_account_id", accountId)
    .maybeSingle();
  if (error) throw aiChatStorageError("Could not load AI chat", error.message);
  return data as AiChatConversationRow | null;
}

async function loadAiChatMessages(conversationId: string): Promise<AiChatMessageRow[]> {
  const { data, error } = await database
    .from("ai_chat_conversations")
    .select("messages")
    .eq("id", conversationId)
    .single();
  if (error) throw aiChatStorageError("Could not load AI chat messages", error.message);
  return Array.isArray(data?.messages) ? data.messages as AiChatMessageRow[] : [];
}

async function saveAiChatMessage(input: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  route?: "sql" | "conversation" | "unsupported" | null;
  routeConfidence?: number | null;
  model?: string | null;
  toolUsed?: boolean;
  generatedSql?: string | null;
  rowCount?: number;
}): Promise<void> {
  const now = new Date().toISOString();
  const messages = await loadAiChatMessages(input.conversationId);
  messages.push({
    id: randomUUID(),
    role: input.role,
    content: input.content,
    route: input.route ?? null,
    route_confidence: input.routeConfidence ?? null,
    model: input.model ?? null,
    tool_used: input.toolUsed ?? false,
    generated_sql: input.generatedSql ?? null,
    row_count: input.rowCount ?? 0,
    created_at: now,
  });
  const { error } = await database
    .from("ai_chat_conversations")
    .update({ messages, last_message_at: now })
    .eq("id", input.conversationId);
  if (error) throw aiChatStorageError("Could not save AI chat message", error.message);
}

function isMissingOperationsMigration(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204" || /pipeline_lock|last_automation/i.test(error.message || "");
}

async function automationAccountState(accountId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await database
    .from("gmail_accounts")
    .select("pipeline_lock_id,pipeline_lock_expires_at,last_automation_started_at,last_automation_completed_at,last_automation_status,last_automation_error,last_automation_metrics")
    .eq("id", accountId)
    .single();
  if (error) {
    if (isMissingOperationsMigration(error)) return null;
    throw new Error(`Could not load automation state: ${error.message}`);
  }
  const state = data as Record<string, unknown>;
  const successResult = await database
    .from("gmail_accounts")
    .select("last_automation_succeeded_at")
    .eq("id", accountId)
    .single();
  if (successResult.error) {
    const missingSuccessColumn = successResult.error.code === "42703"
      || successResult.error.code === "PGRST204"
      || /last_automation_succeeded_at|schema cache/i.test(successResult.error.message || "");
    if (!missingSuccessColumn) throw new Error(`Could not load last successful automation: ${successResult.error.message}`);
    return {
      ...state,
      last_automation_succeeded_at:
        state.last_automation_status === "succeeded" ? state.last_automation_completed_at : null,
      success_timestamp_ready: false,
    };
  }
  return {
    ...state,
    ...(successResult.data as Record<string, unknown>),
    success_timestamp_ready: true,
  };
}

async function automationLockActive(accountId: string): Promise<boolean> {
  const state = await automationAccountState(accountId);
  if (!state?.pipeline_lock_id || !state.pipeline_lock_expires_at) return false;
  return Date.parse(String(state.pipeline_lock_expires_at)) > Date.now();
}

async function loadCommandPipelineBase() {
  const accountId = await primaryAccountId();
  const [accountResult, activeResult, classifiedResult, correctedResult, applicationResult, syncResult, runs, automation] = await Promise.all([
    database
      .from("gmail_accounts")
      .select("gmail_address,last_synced_at,sync_status,last_error")
      .eq("id", accountId)
      .single(),
    database
      .from("emails")
      .select("id", { count: "exact", head: true })
      .eq("gmail_account_id", accountId)
      .is("deleted_at", null),
    database
      .from("email_board")
      .select("email_id", { count: "exact", head: true })
      .eq("gmail_account_id", accountId)
      .not("classification_id", "is", null),
    database
      .from("email_board")
      .select("email_id", { count: "exact", head: true })
      .eq("gmail_account_id", accountId)
      .not("human_category", "is", null),
    database
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("gmail_account_id", accountId),
    database
      .from("sync_runs")
      .select("id,sync_type,status,started_at,finished_at,discovered_count,inserted_count,updated_count,deleted_count,skipped_count,error_message")
      .eq("gmail_account_id", accountId)
      .order("started_at", { ascending: false })
      .limit(5),
    listRecentClassificationRuns(database),
    automationAccountState(accountId),
  ]);
  if (accountResult.error) throw new Error(`Could not load Gmail pipeline account: ${accountResult.error.message}`);
  if (activeResult.error) throw new Error(`Could not count mailbox emails: ${activeResult.error.message}`);
  if (classifiedResult.error) throw new Error(`Could not count classified emails: ${classifiedResult.error.message}`);
  if (correctedResult.error) throw new Error(`Could not count corrected emails: ${correctedResult.error.message}`);
  if (applicationResult.error) throw new Error(`Could not count applications: ${applicationResult.error.message}`);
  if (syncResult.error) throw new Error(`Could not load Gmail sync runs: ${syncResult.error.message}`);
  const activeEmails = activeResult.count || 0;
  const classifiedEmails = classifiedResult.count || 0;
  return {
    account: accountResult.data,
    mailbox: {
      active_emails: activeEmails,
      classified_emails: classifiedEmails,
      unclassified_emails: Math.max(0, activeEmails - classifiedEmails),
      human_corrected_emails: correctedResult.count || 0,
      application_count: applicationResult.count || 0,
    },
    automation: {
      enabled: process.env.AUTOMATION_ENABLED?.trim().toLowerCase() === "true",
      interval_minutes: Number(process.env.AUTOMATION_INTERVAL_MINUTES || "60"),
      migration_ready: automation !== null,
      ...(automation || {}),
    },
    sync_runs: syncResult.data || [],
    runs: runs.filter((run) => run.run_kind === "production" || run.run_kind === "reprocess"),
  };
}

async function commandPipelineSnapshot(forceFresh = false) {
  const live = Boolean(
    activeManualPipeline ||
    gmailIngestion.isRunning() ||
    activeClassificationRuns.size > 0 ||
    activeOutputRefresh,
  );
  if (forceFresh) await analyticsSnapshotCache.delete([commandCenterCacheKey]);
  let base = live
    ? null
    : await analyticsSnapshotCache.get<Awaited<ReturnType<typeof loadCommandPipelineBase>>>(commandCenterCacheKey);
  if (!base) {
    base = await loadCommandPipelineBase();
    if (!live) await analyticsSnapshotCache.set(commandCenterCacheKey, base, 15);
  }
  return {
    ...base,
    outputs: outputRefresh,
    ingestion: gmailIngestion.current(),
    pipeline: manualPipeline,
    runtime: {
      classification_run_ids: [...activeClassificationRuns.keys()],
      classification_worker_running: activeClassificationRuns.size > 0,
      manual_pipeline_running: Boolean(activeManualPipeline),
      output_refresh_running: Boolean(activeOutputRefresh),
      gmail_ingestion_running: gmailIngestion.isRunning(),
    },
    cache: { backend: analyticsSnapshotCache.backend(), live_bypass: live },
  };
}

async function createRecoveryClassificationRun(sourceRunId: string) {
  const source = await getClassificationRun(database, sourceRunId);
  const { data, error } = await database
    .from("email_classifications")
    .select("email_id,status")
    .eq("run_id", sourceRunId)
    .neq("status", "succeeded");
  if (error) throw new Error(`Could not load unfinished classifications: ${error.message}`);
  const emailIds = [...new Set((data || []).map((row) => String(row.email_id)))];
  if (!emailIds.length) throw new Error("This run has no unfinished or failed emails to resume");
  const recovery = await createClassificationRun(database, {
    gmail_account_id: source.gmail_account_id,
    classifier_version: source.classifier_version,
    classifier_config: source.classifier_config,
    run_kind: "reprocess",
    model_requested: source.model_requested,
    selection: { scope: "resume", source_run_id: sourceRunId },
    minimum_top_probability: Number(source.minimum_top_probability),
    concurrency: source.concurrency,
    batch_size: source.batch_size,
  });
  await enqueueClassificationEmails(database, recovery.id, emailIds);
  return { run: recovery, queuedEmailCount: emailIds.length };
}

async function classificationIsActive(): Promise<boolean> {
  if (activeClassificationRuns.size > 0) return true;
  const runs = await listRecentClassificationRuns(database, 5);
  return runs.some((run) =>
    (run.run_kind === "production" || run.run_kind === "reprocess")
    && (run.status === "queued" || run.status === "running"));
}

function startGmailIngestion() {
  return gmailIngestion.start(async (report) => {
    const config = await loadIngestionConfig();
    const gmail = createGmailClient({ ...config.oauth, refreshToken: config.refreshToken });
    const requests = new GmailRequestController({
      requestsPerSecond: config.requestsPerSecond,
      maxRetries: config.maxRetries,
      onRetry: ({ operation, attempt, maxRetries, delayMs, reason }) => {
        report(
          `Gmail throttled ${operation}; retry ${attempt}/${maxRetries} in ${Math.ceil(delayMs / 1_000)}s: ${reason}`,
        );
      },
    });
    report("Reading Gmail profile", { stage: "starting" });
    const profile = await getGmailProfile(gmail, requests);
    const account = await ensureGmailAccount(database, profile.emailAddress);
    report(`Connected to ${profile.emailAddress}`, { stage: "starting" });
    const result = await runIngestion({
      database,
      gmail,
      requests,
      account,
      profileHistoryId: profile.historyId,
      forceFull: false,
      resumeFull: false,
      query: config.gmailQuery,
      includeSpamTrash: config.includeSpamTrash,
      includeOutgoing: config.includeOutgoing,
      maxMessages: config.maxMessages,
      fetchConcurrency: config.fetchConcurrency,
      upsertBatchSize: config.upsertBatchSize,
      onProgress: report,
    });
    emailCache = null;
    invalidateReadCaches();
    if (result.counts.inserted > 0 || result.counts.updated > 0 || result.counts.deleted > 0) {
      outputRefresh = null;
    }
    return {
      ...result,
      gmailAddress: profile.emailAddress,
      mailboxTotal: profile.messagesTotal,
    };
  });
}

const HUMAN_CATEGORIES = [...JEV_CATEGORIES, "uncertain"] as const;

async function boardEmail(emailId: string): Promise<Record<string, unknown>> {
  const [{ data: email, error: emailError }, { data: board, error: boardError }] = await Promise.all([
    database.from("emails").select("*").eq("id", emailId).single(),
    database.from("email_board").select("*").eq("email_id", emailId).single(),
  ]);
  if (emailError) throw new Error(`Could not load email: ${emailError.message}`);
  if (boardError) throw new Error(`Could not load board decision: ${boardError.message}`);
  const record = { ...(board as Record<string, unknown>), ...(email as Record<string, unknown>) };
  return {
    ...record,
    gmail_url: buildGmailDeepLink({
      gmail_message_id: typeof record.gmail_message_id === "string" ? record.gmail_message_id : null,
      gmail_thread_id: typeof record.gmail_thread_id === "string" ? record.gmail_thread_id : null,
      rfc_message_id: typeof record.rfc_message_id === "string" ? record.rfc_message_id : null,
    }),
  };
}

async function loadAiReviewSnapshot() {
  const { data: boardRows, error: boardError, count } = await database
    .from("email_board")
    .select("email_id,internal_date,from_name,from_email,subject,snippet,effective_category,jev_decision,category_top_probability,next_action", { count: "exact" })
    .in("effective_category", ["reply_needed", "information_needed", "interview_assessment", "offer"])
    .order("internal_date", { ascending: false })
    .limit(500);
  if (boardError) throw new Error(`Could not load AI review queue: ${boardError.message}`);
  const ids = (boardRows || []).map((row) => String(row.email_id));
  const stored = new Map<string, Record<string, unknown>>();
  const applicationMembership = new Map<string, string>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const [storedResult, membershipResult] = await Promise.all([
      database
        .from("emails")
        .select("id,llm_review_category,llm_review_confidence,llm_review_should_override,llm_review_input,llm_review_output,llm_review_model,llm_reviewed_at")
        .in("id", batch),
      database
        .from("application_messages")
        .select("email_id,application_id")
        .in("email_id", batch),
    ]);
    if (storedResult.error) throw new Error(`Could not load saved AI reviews. Apply migration 008. ${storedResult.error.message}`);
    if (membershipResult.error) throw new Error(`Could not load AI review application memberships: ${membershipResult.error.message}`);
    for (const row of storedResult.data || []) stored.set(String(row.id), row as Record<string, unknown>);
    for (const row of membershipResult.data || []) applicationMembership.set(String(row.email_id), String(row.application_id));
  }
  const candidates = (boardRows || []).map((row) => ({
    ...row,
    ...(stored.get(String(row.email_id)) || {}),
    current_application_id: applicationMembership.get(String(row.email_id)) || null,
  }));
  return {
    candidates,
    total: count ?? candidates.length,
    models: availableOpenAiModels(),
    ready: Boolean(process.env.OPENAI_API_KEY?.trim()),
    policy: "Jev remains primary. AI reviews high-value lanes and stores a structured recommendation; it does not silently overwrite Jev or a human correction.",
  };
}

async function cachedAiReviewSnapshot() {
  const cached = await analyticsSnapshotCache.get<Awaited<ReturnType<typeof loadAiReviewSnapshot>>>(aiReviewCacheKey);
  if (cached) return cached;
  const snapshot = await loadAiReviewSnapshot();
  await analyticsSnapshotCache.set(aiReviewCacheKey, snapshot, 300);
  return snapshot;
}

async function refreshAiReviewSnapshot(): Promise<void> {
  await analyticsSnapshotCache.delete([aiReviewCacheKey]);
  const snapshot = await loadAiReviewSnapshot();
  await analyticsSnapshotCache.set(aiReviewCacheKey, snapshot, 300);
}

function boardRecordToLabelingEmail(record: Record<string, unknown>): LabelingEmail {
  const direction = record.direction;
  return {
    id: String(record.id || record.email_id || ""),
    gmail_message_id: String(record.gmail_message_id || ""),
    gmail_thread_id: String(record.gmail_thread_id || ""),
    internal_date: String(record.internal_date || ""),
    direction: direction === "incoming" || direction === "outgoing" ? direction : "unknown",
    from_name: typeof record.from_name === "string" ? record.from_name : null,
    from_email: typeof record.from_email === "string" ? record.from_email : null,
    to_recipients: Array.isArray(record.to_recipients)
      ? record.to_recipients as LabelingEmail["to_recipients"]
      : [],
    subject: String(record.subject || ""),
    snippet: String(record.snippet || ""),
    body_text: String(record.body_text || ""),
    label_ids: Array.isArray(record.label_ids)
      ? record.label_ids.filter((value): value is string => typeof value === "string")
      : [],
  };
}

async function saveBoardCorrectionToHumanDataset(
  record: Record<string, unknown>,
  category: string,
  notes: string,
  labeledAt: string,
): Promise<void> {
  await serializeMutation(async () => {
    const [pool, store] = await Promise.all([
      readJson<ReviewPool>(poolPath),
      labelsStore(),
    ]);
    const source = boardRecordToLabelingEmail(record);
    let reviewEmail = pool.emails.find((candidate) => candidate.email_id === source.id);
    if (!reviewEmail) {
      reviewEmail = toReviewEmail(
        source,
        pool.emails.length + 1,
        "board-corrections",
        "board_override",
      );
      pool.emails.push(reviewEmail);
      const batch = pool.batches.find((candidate) => candidate.id === "board-corrections");
      if (batch) batch.count += 1;
      else {
        pool.batches.push({
          id: "board-corrections",
          created_at: labeledAt,
          count: 1,
          strategy: "correction",
        });
      }
      pool.updated_at = labeledAt;
      await writePrivateJson(poolPath, pool);
    }
    const labeled = {
      ...reviewEmail,
      manual_label: category,
      review_notes: notes,
      labeled_at: labeledAt,
    };
    const existingIndex = store.emails.findIndex((candidate) => candidate.email_id === source.id);
    if (existingIndex >= 0) store.emails[existingIndex] = labeled;
    else store.emails.push(labeled);
    store.updated_at = labeledAt;
    await writePrivateJson(labelsPath, store);
  });
}

function workerConfig(input: Record<string, unknown>): ClassificationWorkerConfig {
  const config = {
    model:
      typeof input.model === "string" && input.model.trim()
        ? input.model.trim()
        : process.env.TYPESAFE_MODEL?.trim() || "jev-1.13.0",
    minimumTopProbability:
      typeof input.minimum_top_probability === "number"
        ? input.minimum_top_probability
        : Number(process.env.JEV_MIN_TOP_PROBABILITY || "0.6"),
    concurrency: typeof input.concurrency === "number" ? input.concurrency : 5,
    batchSize: typeof input.batch_size === "number" ? input.batch_size : 25,
    maxRetries: 6,
  };
  validateClassificationConfig(config);
  return config;
}

function startBackgroundClassification(runId: string, config: ClassificationWorkerConfig): void {
  if (activeClassificationRuns.has(runId)) return;
  outputRefresh = null;
  const task = runClassification(database, runId, config)
    .then(() => {
      invalidateReadCaches();
    })
    .catch((error: unknown) => console.error(`Classification run ${runId} failed:`, error))
    .finally(() => activeClassificationRuns.delete(runId));
  activeClassificationRuns.set(runId, task);
}

function startOutputRefresh(sourceRunId: string | null = null): OutputRefreshJob {
  if (activeOutputRefresh && outputRefresh) return outputRefresh;
  outputRefresh = {
    status: "queued",
    stage: "queued",
    progress_percent: 3,
    source_run_id: sourceRunId,
    started_at: null,
    finished_at: null,
    result: null,
    error: null,
    cancellation_requested_at: null,
  };
  const job = outputRefresh;
  const ensureActive = () => {
    if (job.cancellation_requested_at) throw new Error("OUTPUT_REFRESH_CANCELLED");
  };
  activeOutputRefresh = Promise.resolve()
    .then(async () => {
      ensureActive();
      job.status = "running";
      job.stage = "loading_classifications";
      job.progress_percent = 8;
      job.started_at = new Date().toISOString();
      job.result = await materializeApplications(database, {
        onProgress: ({ stage, percent }) => {
          ensureActive();
          job.stage = stage;
          job.progress_percent = percent;
        },
      });
      ensureActive();
      job.stage = "building_analytics";
      job.progress_percent = 96;
      await Promise.all([
        refreshAnalyticsSnapshots(),
        refreshApplicationBoardSnapshot(),
        refreshAiReviewSnapshot(),
        analyticsSnapshotCache.delete([commandCenterCacheKey]),
      ]);
      ensureActive();
      job.status = "succeeded";
      job.stage = "complete";
      job.progress_percent = 100;
      job.finished_at = new Date().toISOString();
    })
    .catch((error: unknown) => {
      if (job.cancellation_requested_at) {
        job.status = "cancelled";
        job.stage = "cancelled";
        job.error = null;
        job.finished_at = new Date().toISOString();
        return;
      }
      job.status = "failed";
      job.stage = "failed";
      job.error = error instanceof Error ? error.message : String(error);
      job.finished_at = new Date().toISOString();
      console.error("Output refresh failed:", error);
    })
    .finally(() => {
      activeOutputRefresh = null;
    });
  return outputRefresh;
}

function cancelOutputRefresh(): boolean {
  if (!activeOutputRefresh || !outputRefresh) return false;
  outputRefresh.cancellation_requested_at ||= new Date().toISOString();
  outputRefresh.stage = "stopping";
  return true;
}

function startManualPipeline(config: ClassificationWorkerConfig = workerConfig({})): ManualPipelineJob {
  manualPipeline = {
    id: randomUUID(),
    status: "queued",
    stage: "queued",
    classification_run_id: null,
    started_at: null,
    finished_at: null,
    error: null,
    cancellation_requested_at: null,
  };
  const job = manualPipeline;
  const ensureActive = () => {
    if (job.cancellation_requested_at) throw new Error("MANUAL_PIPELINE_CANCELLED");
  };
  activeManualPipeline = Promise.resolve()
    .then(async () => {
      ensureActive();
      job.status = "running";
      job.started_at = new Date().toISOString();

      job.stage = "ingestion";
      startGmailIngestion();
      const ingestion = await gmailIngestion.waitForCompletion();
      ensureActive();
      if (ingestion?.status !== "succeeded") throw new Error(ingestion?.error || "Gmail sync failed");

      job.stage = "classification";
      outputRefresh = null;
      const created = await createProductionClassificationRun(
        database,
        await primaryAccountId(),
        { scope: "unclassified", maximum: null, after: null, before: null },
        config,
      );
      job.classification_run_id = created.run.id;
      const classified = await runClassification(database, created.run.id, config);
      invalidateReadCaches();
      ensureActive();
      if (!["succeeded", "partial"].includes(classified.status)) {
        throw new Error(classified.error_message || `Jev classification ${classified.status}`);
      }

      job.stage = "publication";
      const publication = startOutputRefresh(classified.id);
      await activeOutputRefresh;
      ensureActive();
      if (publication.status !== "succeeded") throw new Error(publication.error || "Output publication failed");

      job.status = "succeeded";
      job.stage = "complete";
    })
    .catch((error: unknown) => {
      if (job.cancellation_requested_at) {
        job.status = "cancelled";
        job.stage = "cancelled";
        job.error = null;
        return;
      }
      job.status = "failed";
      job.stage = "failed";
      job.error = error instanceof Error ? error.message : String(error);
      console.error(`Manual pipeline ${job.id} failed:`, error);
    })
    .finally(() => {
      job.finished_at = new Date().toISOString();
      activeManualPipeline = null;
    });
  return job;
}

async function cancelManualPipeline(): Promise<boolean> {
  const job = manualPipeline;
  if (!activeManualPipeline || !job) return false;
  job.cancellation_requested_at ||= new Date().toISOString();
  if (job.stage === "ingestion") gmailIngestion.cancel();
  if (job.stage === "classification" && job.classification_run_id) {
    await requestClassificationCancellation(database, job.classification_run_id);
  }
  if (job.stage === "publication") cancelOutputRefresh();
  return true;
}

function battlegroundConfig(input: Record<string, unknown>): BattlegroundConfig {
  const config = {
    sampleSize: typeof input.sample_size === "number" ? input.sample_size : 50,
    concurrency: typeof input.concurrency === "number" ? input.concurrency : 5,
    model:
      typeof input.model === "string" && input.model.trim()
        ? input.model.trim()
        : process.env.TYPESAFE_MODEL?.trim() || "jev-1.13.0",
    minimumTopProbability:
      typeof input.minimum_top_probability === "number"
        ? input.minimum_top_probability
        : Number(process.env.JEV_MIN_TOP_PROBABILITY || "0.6"),
    maxRetries: typeof input.max_retries === "number" ? input.max_retries : 0,
  };
  validateBattlegroundConfig(config);
  return config;
}

function startBattleground(report: BattlegroundReport, accountId: string): void {
  activeBattleground = runBattleground(database, accountId, report, (updated) => {
    battlegroundReport = updated;
  })
    .then(async (completed) => {
      battlegroundReport = completed;
      await writePrivateJson(battlegroundPath, completed);
    })
    .catch((error: unknown) => console.error(`Battleground ${report.id} failed:`, error))
    .finally(() => {
      activeBattleground = null;
    });
}

type BrowserBattlegroundReport = BattlegroundReport & {
  decision_summary: BattlegroundDecisionSummary[];
};

function battlegroundForBrowser(
  report: BattlegroundReport | null,
  resultLimit = 200,
): BrowserBattlegroundReport | null {
  if (!report) return null;
  const safeLimit = Math.max(0, Math.min(500, resultLimit));
  return {
    ...report,
    decision_summary: summarizeBattlegroundDecisions(report.results),
    results: safeLimit === 0 ? [] : report.results.slice(-safeLimit),
  };
}

async function readAnalyticsEmails(since: string | null): Promise<AnalyticsEmailRow[]> {
  const rows: AnalyticsEmailRow[] = [];
  const pageSize = 1_000;
  for (let offset = 0; ; offset += pageSize) {
    let query = database
      .from("email_board")
      .select(
        "email_id,internal_date,direction,effective_category,human_category,human_label_source,jev_decision,category_top_probability,next_action,should_draft",
      )
      .or("classification_id.not.is.null,human_category.not.is.null")
      .order("email_id")
      .range(offset, offset + pageSize - 1);
    if (since) query = query.gte("internal_date", since);
    const { data, error } = await query;
    if (error) throw new Error(`Could not load analytics emails: ${error.message}`);
    const page = (data || []) as AnalyticsEmailRow[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function readRunTokens(runIds: string[]): Promise<RunTokenRow[]> {
  if (runIds.length === 0) return [];
  const rows: RunTokenRow[] = [];
  const pageSize = 1_000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await database
      .from("email_classifications")
      .select("run_id,input_tokens")
      .in("run_id", runIds)
      .order("run_id")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Could not load analytics token usage: ${error.message}`);
    const page = (data || []) as RunTokenRow[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function readAnalyticsApplications(since: string | null): Promise<Array<{
  id: string;
  current_status: ApplicationStatus;
  company: string | null;
  role: string | null;
  first_activity_at: string;
  last_activity_at: string;
}>> {
  const rows: Array<{
    id: string;
    current_status: ApplicationStatus;
    company: string | null;
    role: string | null;
    first_activity_at: string;
    last_activity_at: string;
  }> = [];
  const pageSize = 1_000;
  for (let offset = 0; ; offset += pageSize) {
    let query = database
      .from("applications")
      .select("id,current_status,company,role,first_activity_at,last_activity_at")
      .order("last_activity_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (since) query = query.gte("last_activity_at", since);
    const { data, error } = await query;
    if (error) throw new Error(`Could not load application analytics: ${error.message}`);
    const page = (data || []) as typeof rows;
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function materializeApplicationBoardSnapshot(): Promise<ApplicationBoardSnapshot> {
  const boardRows: Array<Record<string, unknown>> = [];
  const starRows: Array<Record<string, unknown>> = [];
  const pageSize = 1_000;
  await Promise.all([
    (async () => {
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await database
          .from("application_board")
          .select("*")
          .order("last_activity_at", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw new Error(`Could not materialize Application Board: ${error.message}`);
        const page = (data || []) as Array<Record<string, unknown>>;
        boardRows.push(...page);
        if (page.length < pageSize) break;
      }
    })(),
    (async () => {
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await database
          .from("applications")
          .select("id,is_starred,starred_at")
          .order("last_activity_at", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw new Error(`Could not materialize application star state: ${error.message}`);
        starRows.push(...((data || []) as Array<Record<string, unknown>>));
        if ((data || []).length < pageSize) break;
      }
    })(),
  ]);
  const snapshot = buildApplicationBoardSnapshot(boardRows, starRows);
  await analyticsSnapshotCache.set(applicationBoardCacheKey, snapshot, 86_400);
  return snapshot;
}

interface AnalyticsSource {
  emails: AnalyticsEmailRow[];
  runs: Awaited<ReturnType<typeof listRecentClassificationRuns>>;
  tokens: RunTokenRow[];
  benchmark: ReturnType<typeof benchmarkForAnalytics> | null;
  applications: Awaited<ReturnType<typeof readAnalyticsApplications>> | null;
  now: Date;
}

async function loadAnalyticsSource(): Promise<AnalyticsSource> {
  const now = new Date();
  const [emails, runs, benchmarkExists, applications] = await Promise.all([
    readAnalyticsEmails(null),
    listRecentClassificationRuns(database, 12),
    access(benchmarkPath).then(
      () => true,
      () => false,
    ),
    readAnalyticsApplications(null).catch(() => null),
  ]);
  const [tokens, benchmarkReport] = await Promise.all([
    readRunTokens(runs.map((run) => run.id)),
    benchmarkExists ? readJson<Record<string, unknown>>(benchmarkPath) : Promise.resolve(null),
  ]);
  const benchmark = benchmarkReport?.classifier_version === CLASSIFIER_VERSION
    ? benchmarkForAnalytics(benchmarkReport)
    : null;
  return { emails, runs, tokens, benchmark, applications, now };
}

function buildAnalyticsForRange(source: AnalyticsSource, range: AnalyticsRange) {
  const { now, runs, tokens, benchmark } = source;
  const days = range === "all" ? null : Number(range);
  const sinceDate = days === null ? null : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days + 1));
  const since = sinceDate?.toISOString() || null;
  const after = since ? Date.parse(since) : Number.NEGATIVE_INFINITY;
  const emails = source.emails.filter((email) => Date.parse(email.internal_date) >= after);
  const visibleRuns = since ? runs.filter((run) => Date.parse(run.created_at) >= Date.parse(since)) : runs;
  const emailAnalytics = buildAnalyticsSnapshot(emails, visibleRuns, tokens, benchmark, now, {
    key: range,
    label: range === "all" ? "All time" : `Last ${range} days`,
    days,
    granularity: range === "all" ? "month" : "day",
    from: since,
    to: now.toISOString(),
  });
  if (!source.applications) return { ...emailAnalytics, application_lifecycle: null };
  const applicationRows = source.applications.filter((application) => Date.parse(application.last_activity_at) >= after);
  const statusCounts = APPLICATION_STATUSES.map((status) => ({
    status,
    count: applicationRows.filter((application) => application.current_status === status).length,
  }));
  return {
    ...emailAnalytics,
    application_lifecycle: {
      application_count: applicationRows.length,
      status_breakdown: statusCounts,
      flows: statusCounts
        .filter((item) => item.count > 0)
        .map((item) => ({ source: "all_applications", target: item.status, count: item.count })),
    },
  };
}

async function materializeAnalyticsSnapshots(): Promise<void> {
  const source = await loadAnalyticsSource();
  await Promise.all(analyticsRanges.map(async (range) => {
    const snapshot = buildAnalyticsForRange(source, range);
    await analyticsSnapshotCache.set(analyticsCacheKey(range), snapshot, 86_400);
  }));
}

async function applicationDetail(applicationId: string) {
  const [{ data: application, error: applicationError }, { data: links, error: linkError }, { data: events, error: eventError }] = await Promise.all([
    database.from("applications").select("*").eq("id", applicationId).single(),
    database.from("application_messages").select("email_id,association_source,association_confidence").eq("application_id", applicationId),
    database.from("application_status_events").select("*").eq("application_id", applicationId).order("event_at"),
  ]);
  if (applicationError) throw new Error(`Could not load application: ${applicationError.message}`);
  if (linkError) throw new Error(`Could not load application messages: ${linkError.message}`);
  if (eventError) throw new Error(`Could not load application events: ${eventError.message}`);
  const emailIds = (links || []).map((link) => link.email_id as string);
  let emails: unknown[] = [];
  if (emailIds.length) {
    const [boardResult, identityResult] = await Promise.all([
      database
        .from("email_board")
        .select("email_id,gmail_message_id,gmail_thread_id,internal_date,direction,from_name,from_email,subject,snippet,effective_category,next_action,category_top_probability")
        .in("email_id", emailIds)
        .order("internal_date"),
      database
        .from("emails")
        .select("id,gmail_message_id,gmail_thread_id,rfc_message_id")
        .in("id", emailIds),
    ]);
    if (boardResult.error) throw new Error(`Could not load application email evidence: ${boardResult.error.message}`);
    if (identityResult.error) throw new Error(`Could not load application email identities: ${identityResult.error.message}`);
    const identities = new Map((identityResult.data || []).map((row) => [String(row.id), row]));
    emails = (boardResult.data || []).map((row) => {
      const identity = identities.get(String(row.email_id));
      const gmailIdentity = {
        gmail_message_id: identity?.gmail_message_id || row.gmail_message_id,
        gmail_thread_id: identity?.gmail_thread_id || row.gmail_thread_id,
        rfc_message_id: identity?.rfc_message_id || null,
      };
      return {
        ...row,
        ...gmailIdentity,
        gmail_url: buildGmailDeepLink(gmailIdentity),
      };
    });
  }
  return { application, messages: emails, events: events || [] };
}

function availableOpenAiModels(): string[] {
  const configured = (process.env.OPENAI_MODELS || process.env.OPENAI_MODEL || "gpt-4o-mini")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(configured.length ? configured : ["gpt-4o-mini"])];
}

function replyContext(stored: Record<string, unknown>): ReplyContext {
  return {
    direction: stored.direction as ReplyContext["direction"],
    from_name: typeof stored.from_name === "string" ? stored.from_name : null,
    from_email: typeof stored.from_email === "string" ? stored.from_email : null,
    to_recipients: Array.isArray(stored.to_recipients) ? stored.to_recipients as NonNullable<ReplyContext["to_recipients"]> : [],
    subject: String(stored.subject || ""),
    snippet: String(stored.snippet || ""),
    body_text: String(stored.body_text || ""),
    internal_date: String(stored.internal_date || ""),
    effectiveCategory: typeof stored.effective_category === "string" ? stored.effective_category : null,
    nextAction: typeof stored.next_action === "string" ? stored.next_action : null,
    humanNotes: String(stored.human_label_notes || ""),
  };
}

async function candidateApplications(stored: Record<string, unknown>) {
  const accountId = String(stored.gmail_account_id || "");
  const { data: currentLink } = await database
    .from("application_messages")
    .select("application_id")
    .eq("email_id", String(stored.id || stored.email_id || ""))
    .maybeSingle();
  const stopwords = new Set(["application", "position", "opportunity", "interview", "engineer", "senior", "junior", "update", "thank", "thanks", "reply", "required", "complete"]);
  const domain = String(stored.from_email || "").split("@")[1]?.split(".")[0] || "";
  const tokens = [...new Set(`${domain} ${stored.from_name || ""} ${stored.subject || ""}`
    .toLowerCase()
    .match(/[a-z0-9]{5,}/g) || [])]
    .filter((token) => !stopwords.has(token))
    .slice(0, 7);
  let query = database
    .from("application_board")
    .select("id,company,role,latest_subject,last_activity_at")
    .eq("gmail_account_id", accountId)
    .order("last_activity_at", { ascending: false })
    .limit(30);
  if (tokens.length) {
    query = query.or(tokens.flatMap((token) => [
      `company.ilike.*${token}*`,
      `role.ilike.*${token}*`,
      `latest_subject.ilike.*${token}*`,
    ]).join(","));
  }
  const [{ data, error }, currentApplicationResult] = await Promise.all([
    query,
    currentLink?.application_id
      ? database
        .from("application_board")
        .select("id,company,role,latest_subject,last_activity_at")
        .eq("id", currentLink.application_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (error) throw new Error(`Could not load relationship candidates: ${error.message}`);
  if (currentApplicationResult.error) throw new Error(`Could not load current application: ${currentApplicationResult.error.message}`);
  const applications = [...(data || [])];
  if (currentApplicationResult.data && !applications.some((application) => application.id === currentApplicationResult.data?.id)) {
    applications.unshift(currentApplicationResult.data);
  }
  return applications.map((application) => ({
    id: String(application.id),
    company: typeof application.company === "string" ? application.company : null,
    role: typeof application.role === "string" ? application.role : null,
    latestSubject: typeof application.latest_subject === "string" ? application.latest_subject : null,
    relationshipHint: application.id === currentLink?.application_id ? "current_application" as const : "heuristic_candidate" as const,
  }));
}

async function saveLabel(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const input = await body(request);
  const emailId = typeof input.email_id === "string" ? input.email_id : "";
  const manualLabel = typeof input.manual_label === "string" ? input.manual_label : "";
  const notes = typeof input.review_notes === "string" ? input.review_notes.slice(0, 5_000) : "";
  if (!emailId || !LABEL_CATEGORIES.includes(manualLabel as never)) {
    json(response, 400, { error: "A valid email_id and manual_label are required" });
    return;
  }

  const result = await serializeMutation(async () => {
    const [pool, store] = await Promise.all([
      readJson<ReviewPool>(poolPath),
      labelsStore(),
    ]);
    const email = pool.emails.find((candidate) => candidate.email_id === emailId);
    if (!email) throw new Error("Email is not part of the review pool");
    const labeled = {
      ...email,
      manual_label: manualLabel,
      review_notes: notes,
      labeled_at: new Date().toISOString(),
    };
    const existingIndex = store.emails.findIndex((candidate) => candidate.email_id === emailId);
    if (existingIndex >= 0) store.emails[existingIndex] = labeled;
    else store.emails.push(labeled);
    store.updated_at = labeled.labeled_at;
    await writePrivateJson(labelsPath, store);
    return { labeled_count: store.emails.length, labeled_at: labeled.labeled_at };
  });
  json(response, 200, result);
}

async function addSample(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const input = await body(request);
  const count = typeof input.count === "number" ? input.count : 50;
  const strategy = input.strategy === "random" ? "random" : "balanced";
  if (!Number.isInteger(count) || count < 10 || count > 200) {
    json(response, 400, { error: "count must be an integer from 10 to 200" });
    return;
  }

  const result = await serializeMutation(async () => {
    const pool = await readJson<ReviewPool>(poolPath);
    if (!emailCache) emailCache = await readAllActiveEmails(database);
    const excluded = new Set(pool.emails.map((email) => email.email_id));
    const seed = `add-${Date.now()}-${randomUUID()}`;
    const selected = selectAdditionalSample(emailCache, excluded, count, seed, strategy);
    const now = new Date().toISOString();
    const batchId = `batch-${pool.batches.length + 1}-${randomUUID().slice(0, 8)}`;
    const additions = selected.map((email, index) =>
      toReviewEmail(
        email,
        pool.emails.length + index + 1,
        batchId,
        strategy === "balanced" ? "balanced_discovery" : "random",
      ),
    );
    const batch: ReviewBatch = {
      id: batchId,
      created_at: now,
      count: additions.length,
      strategy,
    };
    pool.emails.push(...additions);
    pool.batches.push(batch);
    pool.updated_at = now;
    pool.source_email_count = emailCache.length;
    await writePrivateJson(poolPath, pool);
    return {
      emails: additions,
      batch,
      total_count: pool.emails.length,
      unseen_remaining: emailCache.length - pool.emails.length,
    };
  });
  json(response, 200, result);
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host}`);
  const path = requestUrl.pathname;
  if (request.method === "GET" && path === "/api/battleground") {
    if (!battlegroundReport) {
      const exists = await access(battlegroundPath).then(
        () => true,
        () => false,
      );
      if (exists) battlegroundReport = await readJson<BattlegroundReport>(battlegroundPath);
    }
    const requestedLimit = Number(requestUrl.searchParams.get("result_limit") || "200");
    json(response, 200, {
      report: battlegroundForBrowser(
        battlegroundReport,
        Number.isFinite(requestedLimit) ? requestedLimit : 200,
      ),
    });
    return;
  }
  if (request.method === "POST" && path === "/api/battleground") {
    if (activeBattleground || battlegroundReport?.status === "running") {
      json(response, 409, { error: "A Battleground run is already in progress" });
      return;
    }
    if (!process.env.TYPESAFE_API_KEY?.trim() || process.env.TYPESAFE_API_KEY === "replace_me") {
      json(response, 400, { error: "Set TYPESAFE_API_KEY before starting Battleground" });
      return;
    }
    const config = battlegroundConfig(await body(request));
    const report: BattlegroundReport = {
      id: randomUUID(),
      status: "queued",
      created_at: new Date().toISOString(),
      started_at: null,
      finished_at: null,
      config,
      active_mailbox_count: 0,
      selected_count: 0,
      completed_count: 0,
      succeeded_count: 0,
      failed_count: 0,
      metrics: null,
      results: [],
      error: null,
    };
    battlegroundReport = report;
    startBattleground(report, await primaryAccountId());
    json(response, 202, { report: battlegroundForBrowser(report) });
    return;
  }
  if (request.method === "GET" && path === "/api/command/preview") {
    const scopeValue = requestUrl.searchParams.get("scope") || "unclassified";
    if (!RUN_SCOPES.includes(scopeValue as RunScope)) {
      json(response, 400, { error: `scope must be one of: ${RUN_SCOPES.join(", ")}` });
      return;
    }
    const maximumValue = requestUrl.searchParams.get("maximum");
    const batchSizeValue = requestUrl.searchParams.get("batch_size");
    const preview = await previewClassificationSelection(
      database,
      await primaryAccountId(),
      {
        scope: scopeValue as RunScope,
        maximum: maximumValue ? Number(maximumValue) : null,
        after: requestUrl.searchParams.get("after"),
        before: requestUrl.searchParams.get("before"),
      },
      batchSizeValue ? Number(batchSizeValue) : 25,
    );
    json(response, 200, preview);
    return;
  }
  if (request.method === "POST" && path === "/api/command/ingest") {
    if (activeManualPipeline) {
      json(response, 409, { error: "The full mailbox pipeline is currently running" });
      return;
    }
    if (gmailIngestion.isRunning()) {
      json(response, 409, { error: "A Gmail ingestion job is already running" });
      return;
    }
    if (await classificationIsActive()) {
      json(response, 409, { error: "Wait for the active Jev classification run to finish before syncing Gmail" });
      return;
    }
    if (await automationLockActive(await primaryAccountId())) {
      json(response, 409, { error: "The scheduled mailbox pipeline is currently running" });
      return;
    }
    json(response, 202, { ingestion: startGmailIngestion() });
    return;
  }
  if (request.method === "GET" && path === "/api/command/status") {
    json(response, 200, await commandPipelineSnapshot(requestUrl.searchParams.get("fresh") === "1"));
    return;
  }
  if (request.method === "POST" && path === "/api/command/pipeline") {
    if (!process.env.TYPESAFE_API_KEY?.trim() || process.env.TYPESAFE_API_KEY === "replace_me") {
      json(response, 400, { error: "Set TYPESAFE_API_KEY before running the pipeline" });
      return;
    }
    if (activeManualPipeline || gmailIngestion.isRunning() || await classificationIsActive() || activeOutputRefresh) {
      json(response, 409, { error: "Another mailbox pipeline step is already running" });
      return;
    }
    if (await automationLockActive(await primaryAccountId())) {
      json(response, 409, { error: "The scheduled mailbox pipeline is currently running" });
      return;
    }
    const input = await body(request);
    const config = workerConfig(input);
    json(response, 202, { pipeline: startManualPipeline(config) });
    return;
  }
  if (request.method === "GET" && path === "/api/operations/health") {
    const snapshot = await commandPipelineSnapshot();
    const account = snapshot.account as Record<string, unknown>;
    const automation = snapshot.automation as Record<string, unknown>;
    const intervalMinutes = Number(automation.interval_minutes || 60);
    const lastSync = account.last_synced_at ? Date.parse(String(account.last_synced_at)) : 0;
    const stale = !lastSync || Date.now() - lastSync > intervalMinutes * 2 * 60_000;
    const failed = account.sync_status === "error" || automation.last_automation_status === "failed";
    json(response, failed ? 503 : 200, {
      status: failed ? "unhealthy" : stale ? "degraded" : "healthy",
      checked_at: new Date().toISOString(),
      scheduler_enabled: automation.enabled,
      scheduler_migration_ready: automation.migration_ready,
      pipeline_locked: await automationLockActive(await primaryAccountId()),
      last_sync_at: account.last_synced_at || null,
      last_cycle_status: automation.last_automation_status || null,
      last_cycle_started_at: automation.last_automation_started_at || null,
      last_cycle_completed_at: automation.last_automation_completed_at || null,
      last_successful_cycle_at: automation.last_automation_succeeded_at || null,
      last_cycle_metrics: automation.last_automation_metrics || {},
      error: automation.last_automation_error || account.last_error || null,
      mailbox: snapshot.mailbox,
    });
    return;
  }
  if (request.method === "POST" && path === "/api/command/publish") {
    if (activeManualPipeline) {
      json(response, 409, { error: "The full mailbox pipeline is currently running" });
      return;
    }
    if (gmailIngestion.isRunning() || await classificationIsActive()) {
      json(response, 409, { error: "Wait for Gmail sync and Jev classification to finish before publishing outputs" });
      return;
    }
    if (await automationLockActive(await primaryAccountId())) {
      json(response, 409, { error: "The scheduled mailbox pipeline is currently running" });
      return;
    }
    const job = startOutputRefresh(null);
    json(response, 202, { outputs: job });
    return;
  }
  if (request.method === "POST" && path === "/api/command/runs") {
    const input = await body(request);
    const scopeValue = typeof input.scope === "string" ? input.scope : "unclassified";
    if (!RUN_SCOPES.includes(scopeValue as RunScope)) {
      json(response, 400, { error: `scope must be one of: ${RUN_SCOPES.join(", ")}` });
      return;
    }
    if (!process.env.TYPESAFE_API_KEY?.trim() || process.env.TYPESAFE_API_KEY === "replace_me") {
      json(response, 400, { error: "Set TYPESAFE_API_KEY before starting a classification run" });
      return;
    }
    if (activeManualPipeline) {
      json(response, 409, { error: "The full mailbox pipeline is currently running" });
      return;
    }
    if (gmailIngestion.isRunning()) {
      json(response, 409, { error: "Wait for Gmail ingestion to finish before starting Jev classification" });
      return;
    }
    if (await automationLockActive(await primaryAccountId())) {
      json(response, 409, { error: "The scheduled mailbox pipeline is currently running" });
      return;
    }
    const config = workerConfig(input);
    const created = await createProductionClassificationRun(
      database,
      await primaryAccountId(),
      {
        scope: scopeValue as RunScope,
        resetExisting: scopeValue === "all" ? input.replace_existing !== false : false,
        maximum: typeof input.maximum === "number" ? input.maximum : null,
        after: typeof input.after === "string" ? input.after : null,
        before: typeof input.before === "string" ? input.before : null,
      },
      config,
    );
    setImmediate(() => startBackgroundClassification(created.run.id, config));
    json(response, 202, { ...created.run, queued_email_count: created.queuedEmailCount });
    return;
  }
  if (request.method === "POST" && path === "/api/command/cancel") {
    const input = await body(request);
    const runId = typeof input.run_id === "string" ? input.run_id : "";
    if (!runId) {
      json(response, 400, { error: "run_id is required" });
      return;
    }
    await requestClassificationCancellation(database, runId);
    json(response, 202, { run_id: runId, cancellation_requested: true });
    return;
  }
  if (request.method === "POST" && path === "/api/command/cancel-active") {
    const input = await body(request);
    const target = typeof input.target === "string" ? input.target : "";
    if (!["pipeline", "ingestion", "classification", "outputs"].includes(target)) {
      json(response, 400, { error: "target must be pipeline, ingestion, classification, or outputs" });
      return;
    }
    if (activeManualPipeline) {
      await cancelManualPipeline();
      json(response, 202, { target: "pipeline", cancellation_requested: true });
      return;
    }
    if (target === "ingestion" && gmailIngestion.cancel()) {
      json(response, 202, { target, cancellation_requested: true });
      return;
    }
    if (target === "classification") {
      const runId = activeClassificationRuns.keys().next().value as string | undefined;
      const activeRun = runId
        ? { id: runId }
        : (await listRecentClassificationRuns(database, 5)).find((run) => run.status === "queued" || run.status === "running");
      if (activeRun) {
        await requestClassificationCancellation(database, activeRun.id);
        json(response, 202, { target, run_id: activeRun.id, cancellation_requested: true });
        return;
      }
    }
    if (target === "outputs" && cancelOutputRefresh()) {
      json(response, 202, { target, cancellation_requested: true });
      return;
    }
    json(response, 409, { error: `No active ${target} job is available to cancel` });
    return;
  }
  if (request.method === "POST" && path === "/api/command/resume") {
    const input = await body(request);
    const runId = typeof input.run_id === "string" ? input.run_id : "";
    if (!runId) {
      json(response, 400, { error: "run_id is required" });
      return;
    }
    if (!process.env.TYPESAFE_API_KEY?.trim() || process.env.TYPESAFE_API_KEY === "replace_me") {
      json(response, 400, { error: "Set TYPESAFE_API_KEY before resuming a classification run" });
      return;
    }
    if (gmailIngestion.isRunning()) {
      json(response, 409, { error: "Wait for Gmail ingestion to finish before resuming Jev classification" });
      return;
    }
    if (activeManualPipeline || activeOutputRefresh) {
      json(response, 409, { error: "Wait for the active mailbox pipeline step to finish before resuming Jev classification" });
      return;
    }
    if (activeClassificationRuns.size > 0) {
      json(response, 409, { error: "A Jev classification worker is already running" });
      return;
    }
    if (await automationLockActive(await primaryAccountId())) {
      json(response, 409, { error: "The scheduled mailbox pipeline is currently running" });
      return;
    }
    const sourceRun = await getClassificationRun(database, runId);
    if (sourceRun.run_kind !== "production" && sourceRun.run_kind !== "reprocess") {
      json(response, 400, { error: "Only production classification runs can be resumed from Command Center" });
      return;
    }
    const terminal = ["partial", "failed", "cancelled"].includes(sourceRun.status);
    const recovery = terminal
      ? await createRecoveryClassificationRun(runId)
      : { run: sourceRun, queuedEmailCount: Math.max(0, sourceRun.total_count - sourceRun.succeeded_count) };
    const run = recovery.run;
    const config = workerConfig({
      model: run.model_requested,
      minimum_top_probability: Number(run.minimum_top_probability),
      concurrency: run.concurrency,
      batch_size: run.batch_size,
    });
    invalidateReadCaches();
    setImmediate(() => startBackgroundClassification(run.id, config));
    json(response, 202, {
      run_id: run.id,
      source_run_id: runId,
      resumed: true,
      queued_email_count: recovery.queuedEmailCount,
    });
    return;
  }
  if (request.method === "GET" && path === "/api/applications") {
    const limit = Math.max(1, Math.min(5_000, Number(requestUrl.searchParams.get("limit") || "500")));
    const offset = Math.max(0, Number(requestUrl.searchParams.get("offset") || "0"));
    const status = requestUrl.searchParams.get("status");
    const starredOnly = requestUrl.searchParams.get("starred") === "true";
    if (!starredOnly && status && status !== "all" && !APPLICATION_STATUSES.includes(status as ApplicationStatus)) {
      json(response, 400, { error: `status must be one of: ${APPLICATION_STATUSES.join(", ")}` });
      return;
    }
    const snapshot = await cachedApplicationBoardSnapshot();
    const source = starredOnly
      ? snapshot.starred
      : status && status !== "all"
        ? snapshot.by_status[status] || []
        : APPLICATION_STATUSES.flatMap((candidate) => snapshot.by_status[candidate] || []);
    const applications = source.slice(offset, offset + limit);
    json(response, 200, {
      applications,
      total: source.length,
      has_more: offset + applications.length < source.length,
      snapshot_generated_at: snapshot.generated_at,
      cache_backend: analyticsSnapshotCache.backend(),
    });
    return;
  }
  if (request.method === "GET" && path === "/api/applications/detail") {
    const applicationId = requestUrl.searchParams.get("id") || "";
    if (!applicationId) {
      json(response, 400, { error: "id is required" });
      return;
    }
    json(response, 200, await applicationDetail(applicationId));
    return;
  }
  if (request.method === "POST" && path === "/api/applications/update") {
    const input = await body(request);
    const applicationId = typeof input.application_id === "string" ? input.application_id : "";
    const status = typeof input.current_status === "string" ? input.current_status : "";
    if (!applicationId || !APPLICATION_STATUSES.includes(status as ApplicationStatus)) {
      json(response, 400, { error: "A valid application_id and current_status are required" });
      return;
    }
    const updatedAt = new Date().toISOString();
    const update = {
      company: typeof input.company === "string" ? input.company.slice(0, 200).trim() || null : null,
      role: typeof input.role === "string" ? input.role.slice(0, 300).trim() || null : null,
      requisition_id: typeof input.requisition_id === "string" ? input.requisition_id.slice(0, 120).trim() || null : null,
      current_status: status,
      ghosted_at: status === "ghosted" ? updatedAt : null,
      grouping_source: "manual",
      manual_notes: typeof input.notes === "string" ? input.notes.slice(0, 5_000) : "",
    };
    const { data, error } = await database
      .from("applications")
      .update(update)
      .eq("id", applicationId)
      .select("*")
      .single();
    if (error) throw new Error(`Could not update application: ${error.message}`);
    const { error: eventError } = await database
      .from("application_status_events")
      .upsert({
        application_id: applicationId,
        email_id: null,
        status,
        event_at: updatedAt,
        source: "manual",
        explanation: update.manual_notes || "Manual application status override",
      }, { onConflict: "application_id,email_id,status", ignoreDuplicates: false });
    if (eventError) throw new Error(`Application saved, but status history failed: ${eventError.message}`);
    await refreshApplicationBoardSnapshot();
    void refreshAnalyticsSnapshots().catch((refreshError: unknown) => {
      console.error("Analytics cache refresh failed after application update:", refreshError);
    });
    json(response, 200, { application: data });
    return;
  }
  if (request.method === "POST" && path === "/api/applications/star") {
    const input = await body(request);
    const applicationId = typeof input.application_id === "string" ? input.application_id : "";
    const starred = input.starred === true;
    if (!applicationId) {
      json(response, 400, { error: "application_id is required" });
      return;
    }
    const { data, error } = await database.rpc("set_application_star", {
      p_application_id: applicationId,
      p_starred: starred,
    });
    if (error) throw new Error(`Could not save star. Apply migration 016. ${error.message}`);
    const saved = (data || {}) as Record<string, unknown>;
    await updateCachedApplicationStar(
      String(saved.id || applicationId),
      Boolean(saved.is_starred),
      typeof saved.starred_at === "string" ? saved.starred_at : null,
    );
    json(response, 200, { application: saved });
    return;
  }
  if (request.method === "POST" && path === "/api/applications/interview-progress") {
    const input = await body(request);
    const applicationId = typeof input.application_id === "string" ? input.application_id : "";
    const progress = input.progress === null || input.progress === "" ? null : input.progress;
    if (!applicationId || (progress !== null && progress !== "pending" && progress !== "completed")) {
      json(response, 400, { error: "application_id and progress (pending, completed, or null) are required" });
      return;
    }
    const { data, error } = await database.rpc("set_application_interview_progress", {
      p_application_id: applicationId,
      p_progress: progress,
    });
    if (error) throw new Error(`Could not save interview progress. Apply migration 020. ${error.message}`);
    const saved = (data || {}) as Record<string, unknown>;
    await updateCachedInterviewProgress(
      String(saved.id || applicationId),
      typeof saved.interview_progress === "string" ? saved.interview_progress : null,
      typeof saved.interview_progress_updated_at === "string" ? saved.interview_progress_updated_at : null,
    );
    json(response, 200, { application: saved });
    return;
  }
  if (request.method === "GET" && path === "/api/board") {
    const limit = Math.max(1, Math.min(1_000, Number(requestUrl.searchParams.get("limit") || "500")));
    const offset = Math.max(0, Number(requestUrl.searchParams.get("offset") || "0"));
    const category = requestUrl.searchParams.get("category");
    const action = requestUrl.searchParams.get("action");
    let query = database
      .from("email_board")
      .select("*", { count: "exact" })
      .or("classification_id.not.is.null,human_category.not.is.null")
      .order("internal_date", { ascending: false })
      .range(offset, offset + limit - 1);
    if (category && category !== "all") query = query.eq("effective_category", category);
    if (action === "needs_action") {
      query = query.not("next_action", "is", null).neq("next_action", "no_action");
    } else if (action && action !== "all") {
      query = query.eq("next_action", action);
    }
    const { data, error, count } = await query;
    if (error) throw new Error(`Could not load Email Board: ${error.message}`);
    const emailRows = data || [];
    const emailIds = emailRows.map((email) => String(email.email_id));
    const assistance = new Map<string, Record<string, unknown>>();
    for (let assistanceOffset = 0; assistanceOffset < emailIds.length; assistanceOffset += 100) {
      const { data: assistanceRows, error: assistanceError } = await database
        .from("emails")
        .select("id,reply_draft_status,reply_draft_generated_at,llm_review_category,llm_review_confidence,llm_review_should_override,llm_reviewed_at")
        .in("id", emailIds.slice(assistanceOffset, assistanceOffset + 100));
      if (assistanceError) throw new Error(`Could not load AI assistance state: ${assistanceError.message}`);
      for (const row of assistanceRows || []) assistance.set(String(row.id), row as Record<string, unknown>);
    }
    const enrichedEmails = emailRows.map((email) => ({ ...email, ...(assistance.get(String(email.email_id)) || {}) }));
    const total = count ?? 0;
    json(response, 200, {
      emails: enrichedEmails,
      total,
      has_more: offset + emailRows.length < total,
      reply_profile: process.env.REPLY_WRITING_PROFILE?.trim() || DEFAULT_REPLY_PROFILE,
      reply_provider_ready: Boolean(process.env.OPENAI_API_KEY?.trim()),
      reply_models: availableOpenAiModels(),
    });
    return;
  }
  if (request.method === "GET" && path === "/api/analytics") {
    const requestedRange = requestUrl.searchParams.get("range") || "30";
    if (!["30", "60", "90", "all"].includes(requestedRange)) {
      json(response, 400, { error: "range must be one of: 30, 60, 90, all" });
      return;
    }
    json(response, 200, await cachedAnalyticsSnapshot(requestedRange as AnalyticsRange));
    return;
  }
  if (request.method === "GET" && path === "/api/board/email") {
    const emailId = requestUrl.searchParams.get("id") || "";
    if (!emailId) {
      json(response, 400, { error: "id is required" });
      return;
    }
    json(response, 200, { email: await boardEmail(emailId) });
    return;
  }
  if (request.method === "POST" && path === "/api/board/correction") {
    const input = await body(request);
    const emailId = typeof input.email_id === "string" ? input.email_id : "";
    const category = typeof input.category === "string" ? input.category : "";
    const notes = typeof input.notes === "string" ? input.notes.slice(0, 5_000) : "";
    if (!emailId || !HUMAN_CATEGORIES.includes(category as never)) {
      json(response, 400, { error: "A valid email_id and category are required" });
      return;
    }
    const labeledAt = new Date().toISOString();
    const { error } = await database
      .from("emails")
      .update({
        human_category: category,
        human_label_source: "board_override",
        human_label_notes: notes,
        human_labeled_at: labeledAt,
      })
      .eq("id", emailId);
    if (error) throw new Error(`Could not save correction: ${error.message}`);
    const corrected = await boardEmail(emailId);
    await saveBoardCorrectionToHumanDataset(corrected, category, notes, labeledAt);
    startOutputRefresh(null);
    json(response, 200, { email: corrected });
    return;
  }
  if (request.method === "POST" && path === "/api/board/draft") {
    const input = await body(request);
    const emailId = typeof input.email_id === "string" ? input.email_id : "";
    const instructions = typeof input.instructions === "string" ? input.instructions.slice(0, 8_000) : "";
    if (!emailId) {
      json(response, 400, { error: "email_id is required" });
      return;
    }
    const stored = await boardEmail(emailId);
    if (!isReplyDraftEligible(typeof stored.effective_category === "string" ? stored.effective_category : null)) {
      json(response, 400, { error: "Reply drafts are available only for emails in the Reply Needed category" });
      return;
    }
    const apiKey = process.env.OPENAI_API_KEY?.trim() || "";
    const requestedModel = typeof input.model === "string" ? input.model.trim() : "";
    const models = availableOpenAiModels();
    const model = requestedModel && models.includes(requestedModel) ? requestedModel : (models[0] ?? "gpt-4o-mini");
    if (!apiKey || !model) {
      json(response, 400, { error: "Set OPENAI_API_KEY and OPENAI_MODEL before generating reply drafts" });
      return;
    }
    const context = replyContext(stored);
    const draft = await generateReplyWithOpenAI(apiKey, model, context, instructions);
    const generatedAt = new Date().toISOString();
    const { error } = await database
      .from("emails")
      .update({
        reply_draft_subject: draft.subject,
        reply_draft_body: draft.body,
        reply_draft_instructions: instructions,
        reply_draft_provider: draft.provider,
        reply_draft_model: draft.model,
        reply_draft_generated_at: generatedAt,
        reply_draft_status: "suggested",
        reply_draft_reviewed_at: null,
      })
      .eq("id", emailId);
    if (error) throw new Error(`Could not save reply draft: ${error.message}`);
    json(response, 200, { draft: { ...draft, generated_at: generatedAt } });
    return;
  }
  if (request.method === "POST" && path === "/api/board/draft/stream") {
    const input = await body(request);
    const emailId = typeof input.email_id === "string" ? input.email_id : "";
    const instructions = typeof input.instructions === "string" ? input.instructions.slice(0, 8_000) : "";
    const models = availableOpenAiModels();
    const requestedModel = typeof input.model === "string" ? input.model.trim() : "";
    const model = requestedModel && models.includes(requestedModel) ? requestedModel : (models[0] ?? "gpt-4o-mini");
    if (!emailId) {
      json(response, 400, { error: "email_id is required" });
      return;
    }
    const stored = await boardEmail(emailId);
    if (!isReplyDraftEligible(typeof stored.effective_category === "string" ? stored.effective_category : null)) {
      json(response, 400, { error: "Reply drafts are available only for Reply Needed emails" });
      return;
    }
    const apiKey = process.env.OPENAI_API_KEY?.trim() || "";
    if (!apiKey) {
      json(response, 400, { error: "Set OPENAI_API_KEY before generating reply drafts" });
      return;
    }
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    });
    const emit = (value: unknown) => response.write(`${JSON.stringify(value)}\n`);
    try {
      const context = replyContext(stored);
      const draft = await streamReplyWithOpenAI(apiKey, model, context, instructions, (delta) => emit({ type: "delta", delta }));
      const generatedAt = new Date().toISOString();
      const { error } = await database.from("emails").update({
        reply_draft_subject: draft.subject,
        reply_draft_body: draft.body,
        reply_draft_instructions: instructions,
        reply_draft_provider: draft.provider,
        reply_draft_model: draft.model,
        reply_draft_generated_at: generatedAt,
        reply_draft_status: "suggested",
        reply_draft_reviewed_at: null,
      }).eq("id", emailId);
      if (error) throw new Error(`Could not save reply draft: ${error.message}`);
      emit({ type: "done", draft: { ...draft, generated_at: generatedAt } });
    } catch (error) {
      emit({ type: "error", error: error instanceof Error ? error.message : String(error) });
    } finally {
      response.end();
    }
    return;
  }
  if (request.method === "POST" && path === "/api/board/draft/save") {
    const input = await body(request);
    const emailId = typeof input.email_id === "string" ? input.email_id : "";
    const subject = typeof input.subject === "string" ? input.subject.trim().slice(0, 998) : "";
    const draftBody = typeof input.body === "string" ? input.body.trim().slice(0, 50_000) : "";
    if (!emailId || !subject || !draftBody) {
      json(response, 400, { error: "email_id, subject, and body are required" });
      return;
    }
    const stored = await boardEmail(emailId);
    if (!isReplyDraftEligible(typeof stored.effective_category === "string" ? stored.effective_category : null)) {
      json(response, 400, { error: "Reply drafts are available only for emails in the Reply Needed category" });
      return;
    }
    const reviewedAt = new Date().toISOString();
    const { error } = await database
      .from("emails")
      .update({
        reply_draft_subject: subject,
        reply_draft_body: draftBody,
        reply_draft_status: "reviewed",
        reply_draft_reviewed_at: reviewedAt,
      })
      .eq("id", emailId);
    if (error) throw new Error(`Could not save reviewed reply draft: ${error.message}`);
    json(response, 200, {
      draft: { subject, body: draftBody, status: "reviewed", reviewed_at: reviewedAt },
      sent: false,
    });
    return;
  }
  if (request.method === "GET" && path === "/api/ai/reviews") {
    const limit = Math.max(1, Math.min(500, Number(requestUrl.searchParams.get("limit") || "500")));
    const snapshot = await cachedAiReviewSnapshot();
    json(response, 200, {
      ...snapshot,
      candidates: snapshot.candidates.slice(0, limit),
      cache: { backend: analyticsSnapshotCache.backend() },
    });
    return;
  }
  if (request.method === "POST" && path === "/api/ai/review") {
    const input = await body(request);
    const emailId = typeof input.email_id === "string" ? input.email_id : "";
    const models = availableOpenAiModels();
    const requestedModel = typeof input.model === "string" ? input.model.trim() : "";
    const model = requestedModel && models.includes(requestedModel) ? requestedModel : (models[0] ?? "gpt-4o-mini");
    const apiKey = process.env.OPENAI_API_KEY?.trim() || "";
    if (!emailId || !apiKey) {
      json(response, 400, { error: !emailId ? "email_id is required" : "Set OPENAI_API_KEY before running AI review" });
      return;
    }
    const stored = await boardEmail(emailId);
    const reviewInput: LlmReviewInput = {
      ...replyContext(stored),
      emailId,
      jevCategory: typeof stored.jev_decision === "string" ? stored.jev_decision : null,
      jevConfidence: typeof stored.category_top_probability === "number" ? stored.category_top_probability : null,
      nextAction: typeof stored.next_action === "string" ? stored.next_action : null,
      candidateApplications: await candidateApplications(stored),
    };
    const effectiveCategory = typeof stored.effective_category === "string" ? stored.effective_category : null;
    const isHighValueLane = ["reply_needed", "information_needed", "interview_assessment", "offer"].includes(effectiveCategory || "");
    if (!isHighValueLane && !shouldRequestLlmReview(reviewInput.jevCategory, reviewInput.jevConfidence)) {
      json(response, 400, { error: "This decision is not in the targeted AI review policy" });
      return;
    }
    const decision = await reviewEmailWithOpenAI(apiKey, model, reviewInput);
    const reviewedAt = new Date().toISOString();
    const exactInput = buildLlmReviewPayload(reviewInput);
    const { error } = await database.from("emails").update({
      llm_review_category: decision.category,
      llm_review_confidence: decision.confidence,
      llm_review_should_override: decision.should_override_jev,
      llm_review_input: exactInput,
      llm_review_output: decision,
      llm_review_model: model,
      llm_reviewed_at: reviewedAt,
    }).eq("id", emailId);
    if (error) throw new Error(`Could not save AI review. Apply migration 008. ${error.message}`);
    await analyticsSnapshotCache.delete([aiReviewCacheKey]);
    json(response, 200, { decision, input: exactInput, model, reviewed_at: reviewedAt });
    return;
  }
  if (request.method === "POST" && path === "/api/ai/relationship/apply") {
    const input = await body(request);
    const emailId = typeof input.email_id === "string" ? input.email_id : "";
    const applicationId = typeof input.application_id === "string" ? input.application_id : "";
    if (!emailId || !applicationId) {
      json(response, 400, { error: "email_id and application_id are required" });
      return;
    }
    const stored = await boardEmail(emailId);
    const output = stored.llm_review_output as { related_application_id?: unknown; relationship_confidence?: unknown } | null;
    if (output?.related_application_id !== applicationId || Number(output.relationship_confidence || 0) < 0.85) {
      json(response, 400, { error: "A saved AI relationship recommendation with at least 85% confidence is required" });
      return;
    }
    const { error } = await database.from("application_messages").update({
      application_id: applicationId,
      association_source: "manual",
      association_confidence: Number(output.relationship_confidence),
    }).eq("email_id", emailId);
    if (error) throw new Error(`Could not join email to application: ${error.message}`);
    startOutputRefresh(null);
    json(response, 200, { email_id: emailId, application_id: applicationId, joined: true });
    return;
  }
  if (request.method === "GET" && path === "/api/ai/chats") {
    const accountId = await primaryAccountId();
    const { data, error } = await database
      .from("ai_chat_conversations")
      .select("id,gmail_account_id,title,archived_at,last_message_at,created_at,updated_at")
      .eq("gmail_account_id", accountId)
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (error) throw aiChatStorageError("Could not list AI chats", error.message);
    json(response, 200, { conversations: data || [] });
    return;
  }
  if (request.method === "POST" && path === "/api/ai/chats") {
    const conversation = await createAiChatConversation(await primaryAccountId());
    json(response, 201, { conversation });
    return;
  }
  const aiChatMessagesMatch = path.match(/^\/api\/ai\/chats\/([0-9a-f-]{36})\/messages$/i);
  if (request.method === "GET" && aiChatMessagesMatch) {
    const accountId = await primaryAccountId();
    const conversation = await getAiChatConversation(accountId, aiChatMessagesMatch[1] || "");
    if (!conversation) {
      json(response, 404, { error: "AI chat was not found" });
      return;
    }
    const { messages, ...conversationMetadata } = conversation;
    json(response, 200, { conversation: conversationMetadata, messages });
    return;
  }
  const aiChatConversationMatch = path.match(/^\/api\/ai\/chats\/([0-9a-f-]{36})$/i);
  if (request.method === "PATCH" && aiChatConversationMatch) {
    const accountId = await primaryAccountId();
    const conversationId = aiChatConversationMatch[1] || "";
    if (!await getAiChatConversation(accountId, conversationId)) {
      json(response, 404, { error: "AI chat was not found" });
      return;
    }
    const input = await body(request);
    if (typeof input.archived !== "boolean") {
      json(response, 400, { error: "archived must be a boolean" });
      return;
    }
    const { data, error } = await database
      .from("ai_chat_conversations")
      .update({ archived_at: input.archived ? new Date().toISOString() : null })
      .eq("id", conversationId)
      .eq("gmail_account_id", accountId)
      .select("id,gmail_account_id,title,archived_at,last_message_at,created_at,updated_at")
      .single();
    if (error) throw aiChatStorageError("Could not update AI chat", error.message);
    json(response, 200, { conversation: data });
    return;
  }
  if (request.method === "DELETE" && aiChatConversationMatch) {
    const accountId = await primaryAccountId();
    const conversationId = aiChatConversationMatch[1] || "";
    const { data, error } = await database
      .from("ai_chat_conversations")
      .delete()
      .eq("id", conversationId)
      .eq("gmail_account_id", accountId)
      .select("id")
      .maybeSingle();
    if (error) throw aiChatStorageError("Could not delete AI chat", error.message);
    if (!data) {
      json(response, 404, { error: "AI chat was not found" });
      return;
    }
    json(response, 200, { deleted: true, conversation_id: conversationId });
    return;
  }
  if (request.method === "POST" && path === "/api/ai/chat") {
    const input = await body(request);
    const question = typeof input.question === "string" ? input.question.trim().slice(0, 2_000) : "";
    const apiKey = process.env.OPENAI_API_KEY?.trim() || "";
    const models = availableOpenAiModels();
    const requestedModel = typeof input.model === "string" ? input.model.trim() : "";
    const model = requestedModel && models.includes(requestedModel) ? requestedModel : (models[0] ?? "gpt-4o-mini");
    if (!question) {
      json(response, 400, { error: "question is required" });
      return;
    }
    if (!apiKey) {
      json(response, 400, { error: "Set OPENAI_API_KEY before using AI Chat" });
      return;
    }
    if (!process.env.TYPESAFE_API_KEY?.trim()) {
      json(response, 400, { error: "Set TYPESAFE_API_KEY before using AI Chat routing" });
      return;
    }
    const accountId = await primaryAccountId();
    const requestedConversationId = typeof input.conversation_id === "string" ? input.conversation_id.trim() : "";
    const conversation = requestedConversationId
      ? await getAiChatConversation(accountId, requestedConversationId)
      : await createAiChatConversation(accountId);
    if (!conversation) {
      json(response, 404, { error: "AI chat was not found" });
      return;
    }
    if (conversation.archived_at) {
      json(response, 409, { error: "This chat is closed. Start a new chat to continue." });
      return;
    }
    const storedMessages = await loadAiChatMessages(conversation.id);
    const history: AiChatHistoryMessage[] = storedMessages.slice(-6).map((message) => ({
      role: message.role,
      text: message.content.slice(0, 1_000),
    }));
    await saveAiChatMessage({ conversationId: conversation.id, role: "user", content: question });
    let conversationTitle = conversation.title;
    if (conversation.title === "New chat" && !storedMessages.length) {
      conversationTitle = aiChatTitle(question);
      const { error: titleError } = await database
        .from("ai_chat_conversations")
        .update({ title: conversationTitle })
        .eq("id", conversation.id)
        .eq("gmail_account_id", accountId);
      if (titleError) throw aiChatStorageError("Could not title AI chat", titleError.message);
    }
    const jevModel = process.env.TYPESAFE_MODEL?.trim() || "jev-1.13.0";
    const router = new TypeSafeClient({
      defaultModel: jevModel,
      timeout: 15_000,
      retry: { maxRetries: 2 },
    });
    const route = await routeAiChatMessage(router, question, history, jevModel);
    if (route.route === "unsupported") {
      const answer = "I can help with read-only questions about your job-search applications and classified emails, but I can’t perform changes or answer unrelated external questions here.";
      await saveAiChatMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: answer,
        route: route.route,
        routeConfidence: route.confidence,
        model,
      });
      json(response, 200, {
        answer,
        sql: null,
        explanation: "Jev routed this message outside the read-only mailbox scope.",
        row_count: 0,
        rows: [],
        model,
        tool_used: false,
        route,
        conversation_id: conversation.id,
        conversation_title: conversationTitle,
      });
      return;
    }
    if (route.route === "conversation") {
      const answer = await answerConversationWithOpenAI(apiKey, model, question, history);
      await saveAiChatMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: answer,
        route: route.route,
        routeConfidence: route.confidence,
        model,
      });
      json(response, 200, {
        answer,
        sql: null,
        explanation: "Jev determined that no mailbox lookup was needed.",
        row_count: 0,
        rows: [],
        model,
        tool_used: false,
        route,
        conversation_id: conversation.id,
        conversation_title: conversationTitle,
      });
      return;
    }
    let generated = await generateSqlWithOpenAI(apiKey, model, question, history);
    let execution = await database.rpc("execute_ai_readonly_sql", {
      p_gmail_account_id: accountId,
      p_sql: generated.sql,
    });
    const firstExecutionError = execution.error;
    if (firstExecutionError && isRepairableSqlExecutionError(firstExecutionError)) {
      generated = await repairSqlWithOpenAI(
        apiKey,
        model,
        question,
        history,
        generated.sql,
        firstExecutionError.message,
      );
      execution = await database.rpc("execute_ai_readonly_sql", {
        p_gmail_account_id: accountId,
        p_sql: generated.sql,
      });
    }
    const { data, error } = execution;
    if (error) {
      const answer = aiChatSqlFailureMessage(error);
      await saveAiChatMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: answer,
        route: route.route,
        routeConfidence: route.confidence,
        model,
        toolUsed: true,
        generatedSql: generated.sql,
        rowCount: 0,
      });
      json(response, 200, {
        answer,
        sql: generated.sql,
        explanation: "The database rejected both the initial query and one schema-aware repair attempt.",
        row_count: 0,
        rows: [],
        model,
        tool_used: true,
        tool_error: true,
        route,
        conversation_id: conversation.id,
        conversation_title: conversationTitle,
      });
      return;
    }
    const rows = Array.isArray(data) ? data as Array<Record<string, unknown>> : [];
    const answer = await answerSqlResultWithOpenAI(apiKey, model, question, generated.sql, rows);
    await saveAiChatMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: answer,
      route: route.route,
      routeConfidence: route.confidence,
      model,
      toolUsed: true,
      generatedSql: generated.sql,
      rowCount: rows.length,
    });
    json(response, 200, {
      answer,
      sql: generated.sql,
      explanation: generated.explanation,
      row_count: rows.length,
      rows: rows.slice(0, 25),
      model,
      tool_used: true,
      route,
      conversation_id: conversation.id,
      conversation_title: conversationTitle,
    });
    return;
  }
  if (request.method === "GET" && path === "/api/benchmark") {
    const allLabeled = requestUrl.searchParams.get("scope") === "all";
    const selectedBenchmarkPath = allLabeled ? allLabeledBenchmarkPath : benchmarkPath;
    const exists = await access(selectedBenchmarkPath).then(
      () => true,
      () => false,
    );
    if (exists) {
      const report = await readJson<{ classifier_version?: string }>(selectedBenchmarkPath);
      if (report.classifier_version === CLASSIFIER_VERSION) {
        json(response, 200, { status: "complete", report });
        return;
      }
      const evaluationCount = allLabeled
        ? (await labelsStore()).emails.filter((email) =>
            JEV_CATEGORIES.includes(email.manual_label as never),
          ).length
        : (await readJson<{ emails: unknown[] }>(evaluationPath)).emails.length;
      json(response, 200, {
        status: "stale",
        evaluation_count: evaluationCount,
        api_key_configured: Boolean(
          process.env.TYPESAFE_API_KEY?.trim() &&
            process.env.TYPESAFE_API_KEY !== "replace_me"
        ),
        command: allLabeled ? "npm run jev:evaluate:all" : "npm run jev:evaluate",
        current_classifier_version: CLASSIFIER_VERSION,
        result_classifier_version: report.classifier_version || "legacy-unversioned",
      });
      return;
    }
    const evaluationCount = allLabeled
      ? (await labelsStore()).emails.filter((email) =>
          JEV_CATEGORIES.includes(email.manual_label as never),
        ).length
      : (await readJson<{ emails: unknown[] }>(evaluationPath)).emails.length;
    json(response, 200, {
      status: "not_run",
      evaluation_count: evaluationCount,
      api_key_configured: Boolean(
        process.env.TYPESAFE_API_KEY?.trim() &&
          process.env.TYPESAFE_API_KEY !== "replace_me"
      ),
      command: allLabeled ? "npm run jev:evaluate:all" : "npm run jev:evaluate",
    });
    return;
  }
  if (request.method === "GET" && path === "/api/labels") {
    json(response, 200, await labelsStore());
    return;
  }
  if (request.method === "POST" && path === "/api/labels") {
    await saveLabel(request, response);
    return;
  }
  if (request.method === "POST" && path === "/api/resample") {
    await addSample(request, response);
    return;
  }

  const filePath = request.method === "GET" ? routes.get(path) : undefined;
  if (!filePath) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });
  createReadStream(filePath).pipe(response);
}

const server = createServer((request, response) => {
  void handle(request, response).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (!response.headersSent) json(response, 500, { error: message });
    else response.end();
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Email Automation Jev dashboard: http://127.0.0.1:${port}`);
  console.log("Review labels save to private JSON; classifications, corrections, drafts, and applications save to Supabase.");
  void Promise.all([cachedAnalyticsSnapshot("30"), cachedApplicationBoardSnapshot()])
    .then(() => console.log(`Analytics and Application Board snapshots ready (${analyticsSnapshotCache.backend()} cache).`))
    .catch((error: unknown) => console.error("Analytics cache warm-up failed:", error));
  console.log("Press Ctrl+C to stop.");
});
