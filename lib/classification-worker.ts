import { TypeSafeClient } from "@typesafe-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createClassificationRun,
  enqueueClassificationEmails,
  finishClassificationRun,
  getClassificationRun,
  listQueuedClassificationEmailIds,
  refreshClassificationRunCounters,
  resetAccountClassificationState,
  saveClassificationBatch,
  startClassificationRun,
  type ClassificationBatchOutcome,
} from "./classification-repository.js";
import {
  CLASSIFIER_VERSION,
  classifyEmailWithJev,
  type ClassifiableEmail,
  type JevClassification,
} from "./jev-classifier.js";
import type { ClassificationRunRow, ClassificationRunStatus } from "./classification-types.js";

export const RUN_SCOPES = ["all", "unclassified", "failed", "uncertain"] as const;
export type RunScope = (typeof RUN_SCOPES)[number];

export interface ClassificationWorkerConfig {
  model: string;
  minimumTopProbability: number;
  concurrency: number;
  batchSize: number;
  maxRetries: number;
}

export interface SelectionOptions {
  scope: RunScope;
  resetExisting?: boolean;
  maximum?: number | null;
  after?: string | null;
  before?: string | null;
  emailIds?: string[];
}

export interface SelectionPreview {
  scope: RunScope;
  available_count: number;
  previously_classified_count: number;
  selected_count: number;
  batch_count: number;
}

export function validateSelectionOptions(options: SelectionOptions): void {
  if (options.resetExisting === true && options.scope !== "all") {
    throw new Error("replacing existing classifications requires the entire-mailbox scope");
  }
  if (options.scope !== "all") return;
  if (
    options.maximum !== undefined && options.maximum !== null
    || Boolean(options.after)
    || Boolean(options.before)
    || Boolean(options.emailIds?.length)
  ) {
    throw new Error(
      "scope all is a destructive full-mailbox rebuild and cannot be combined with limit, date, or email-id filters",
    );
  }
}

interface StoredEmail extends ClassifiableEmail {
  id: string;
}

const EMAIL_FIELDS = "id,direction,from_name,from_email,to_recipients,subject,snippet,body_text,internal_date";
const PAGE_SIZE = 1_000;

export function validateClassificationConfig(config: ClassificationWorkerConfig): void {
  if (!Number.isInteger(config.concurrency) || config.concurrency < 1 || config.concurrency > 10) {
    throw new Error("concurrency must be an integer from 1 to 10");
  }
  if (!Number.isInteger(config.batchSize) || config.batchSize < 1 || config.batchSize > 250) {
    throw new Error("batchSize must be an integer from 1 to 250");
  }
  if (!Number.isInteger(config.maxRetries) || config.maxRetries < 0 || config.maxRetries > 6) {
    throw new Error("maxRetries must be an integer from 0 to 6");
  }
  if (!Number.isFinite(config.minimumTopProbability) || config.minimumTopProbability < 0 || config.minimumTopProbability > 1) {
    throw new Error("minimumTopProbability must be between 0 and 1");
  }
  if (!config.model.trim()) throw new Error("model is required");
}

async function readPagedIds(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<string[]> {
  const ids: string[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await page(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not select classification emails: ${error.message}`);
    const rows = (data || []) as Array<{ id?: string; email_id?: string }>;
    ids.push(...rows.map((row) => row.id || row.email_id).filter((id): id is string => Boolean(id)));
    if (rows.length < PAGE_SIZE) return ids;
  }
}

async function activeEmailIds(
  database: SupabaseClient,
  accountId: string,
  options: SelectionOptions,
): Promise<string[]> {
  const customIds = options.emailIds?.filter(Boolean);
  return readPagedIds((from, to) => {
    let query = database
      .from("emails")
      .select("id")
      .eq("gmail_account_id", accountId)
      .is("deleted_at", null)
      .order("internal_date", { ascending: false })
      .range(from, to);
    if (options.after) query = query.gte("internal_date", options.after);
    if (options.before) query = query.lte("internal_date", options.before);
    if (customIds?.length) query = query.in("id", customIds);
    return query;
  });
}

async function latestClassifiedIds(database: SupabaseClient, accountId: string): Promise<Set<string>> {
  const ids = await readPagedIds((from, to) =>
    database
      .from("email_classifications")
      .select("email_id,classification_runs!inner(gmail_account_id,classifier_version)")
      .eq("status", "succeeded")
      .eq("classification_runs.gmail_account_id", accountId)
      .eq("classification_runs.classifier_version", CLASSIFIER_VERSION)
      .in("classification_runs.status", ["succeeded", "partial"])
      .in("classification_runs.run_kind", ["production", "reprocess"])
      .order("email_id")
      .range(from, to),
  );
  return new Set(ids);
}

async function scopedResultIds(
  database: SupabaseClient,
  accountId: string,
  scope: "failed" | "uncertain",
): Promise<Set<string>> {
  if (scope === "uncertain") {
    const ids = await readPagedIds((from, to) =>
      database
        .from("email_board")
        .select("email_id")
        .eq("gmail_account_id", accountId)
        .eq("jev_decision", "uncertain")
        .order("email_id")
        .range(from, to),
    );
    return new Set(ids);
  }
  const ids = await readPagedIds((from, to) =>
    database
      .from("email_classifications")
      .select("email_id,classification_runs!inner(gmail_account_id)")
      .eq("status", "failed")
      .eq("classification_runs.gmail_account_id", accountId)
      .order("email_id")
      .range(from, to),
  );
  return new Set(ids);
}

export async function selectClassificationEmailIds(
  database: SupabaseClient,
  accountId: string,
  options: SelectionOptions,
): Promise<{ ids: string[]; previouslyClassifiedCount: number }> {
  let candidates = await activeEmailIds(database, accountId, options);
  const classified = await latestClassifiedIds(database, accountId);
  if (options.scope === "unclassified") {
    candidates = candidates.filter((id) => !classified.has(id));
  } else if (options.scope === "failed" || options.scope === "uncertain") {
    const scoped = await scopedResultIds(database, accountId, options.scope);
    candidates = candidates.filter((id) => scoped.has(id));
  }
  const maximum = options.maximum ?? null;
  if (maximum !== null) {
    if (!Number.isInteger(maximum) || maximum < 1) throw new Error("maximum must be a positive integer");
    candidates = candidates.slice(0, maximum);
  }
  return { ids: candidates, previouslyClassifiedCount: classified.size };
}

export async function previewClassificationSelection(
  database: SupabaseClient,
  accountId: string,
  options: SelectionOptions,
  batchSize = 25,
): Promise<SelectionPreview> {
  const unrestricted = await selectClassificationEmailIds(database, accountId, { ...options, maximum: null });
  const selectedCount = options.maximum ? Math.min(unrestricted.ids.length, options.maximum) : unrestricted.ids.length;
  return {
    scope: options.scope,
    available_count: unrestricted.ids.length,
    previously_classified_count: unrestricted.previouslyClassifiedCount,
    selected_count: selectedCount,
    batch_count: Math.ceil(selectedCount / batchSize),
  };
}

async function loadEmails(database: SupabaseClient, emailIds: string[]): Promise<Map<string, StoredEmail>> {
  const chunkSize = 100;
  const chunks = Array.from(
    { length: Math.ceil(emailIds.length / chunkSize) },
    (_, index) => emailIds.slice(index * chunkSize, (index + 1) * chunkSize),
  );
  const pages = await Promise.all(chunks.map(async (ids) => {
    const { data, error } = await database
      .from("emails")
      .select(EMAIL_FIELDS)
      .in("id", ids)
      .is("deleted_at", null);
    if (error) throw new Error(`Could not bulk-load classification emails: ${error.message}`);
    return (data || []) as StoredEmail[];
  }));
  return new Map(pages.flat().map((email) => [email.id, email]));
}

export async function mapConcurrent<T>(values: T[], concurrency: number, mapper: (value: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < values.length) {
      const value = values[cursor];
      cursor += 1;
      if (value !== undefined) await mapper(value);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
}

export function terminalRunStatus(run: Pick<ClassificationRunRow, "succeeded_count" | "failed_count">, cancelled: boolean): ClassificationRunStatus {
  if (cancelled) return "cancelled";
  if (run.failed_count > 0 && run.succeeded_count > 0) return "partial";
  if (run.failed_count > 0) return "failed";
  return "succeeded";
}

export async function runClassification(
  database: SupabaseClient,
  runId: string,
  config: ClassificationWorkerConfig,
  classify?: (email: ClassifiableEmail) => Promise<JevClassification>,
): Promise<ClassificationRunRow> {
  validateClassificationConfig(config);
  await startClassificationRun(database, runId);
  try {
    const client = classify
      ? null
      : new TypeSafeClient({
          defaultModel: config.model,
          timeout: 30_000,
          retry: { maxRetries: config.maxRetries },
        });
    const classifyEmail =
      classify ||
      ((email: ClassifiableEmail) =>
        classifyEmailWithJev(client as TypeSafeClient, email, {
          model: config.model,
          minimumTopProbability: config.minimumTopProbability,
        }));
    const queuedIds = await listQueuedClassificationEmailIds(database, runId);
    let cancelled = false;

    for (let offset = 0; offset < queuedIds.length; offset += config.batchSize) {
      const run = await getClassificationRun(database, runId);
      if (run.cancellation_requested_at) {
        cancelled = true;
        break;
      }
      const batch = queuedIds.slice(offset, offset + config.batchSize);
      const emails = await loadEmails(database, batch);
      const outcomes: ClassificationBatchOutcome[] = [];
      await mapConcurrent(batch, config.concurrency, async (emailId) => {
        try {
          const email = emails.get(emailId);
          if (!email) throw new Error(`Email ${emailId} disappeared before classification`);
          const result = await classifyEmail(email);
          outcomes.push({ emailId, result });
        } catch (error) {
          outcomes.push({ emailId, error });
        }
      });
      await saveClassificationBatch(database, runId, outcomes);
      await refreshClassificationRunCounters(database, runId);
    }

    await refreshClassificationRunCounters(database, runId);
    const summary = await getClassificationRun(database, runId);
    const status = terminalRunStatus(summary, cancelled);
    const errorMessage =
      status === "failed"
        ? summary.error_message || "All queued email classifications failed"
        : status === "partial"
          ? summary.error_message
          : null;
    await finishClassificationRun(database, runId, status, errorMessage);
    return getClassificationRun(database, runId);
  } catch (error) {
    const summary = await getClassificationRun(database, runId);
    const status = summary.succeeded_count > 0 ? "partial" : "failed";
    await finishClassificationRun(database, runId, status, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function createProductionClassificationRun(
  database: SupabaseClient,
  accountId: string,
  options: SelectionOptions,
  config: ClassificationWorkerConfig,
): Promise<{ run: ClassificationRunRow; queuedEmailCount: number }> {
  validateClassificationConfig(config);
  validateSelectionOptions(options);
  const fullReset = options.scope === "all" && options.resetExisting !== false
    ? await resetAccountClassificationState(database, accountId)
    : null;
  const selection = await selectClassificationEmailIds(database, accountId, options);
  const run = await createClassificationRun(database, {
    gmail_account_id: accountId,
    classifier_version: CLASSIFIER_VERSION,
    classifier_config: {
      judgments: ["category", "action", "urgency", "draft_reply"],
      reference_strategy: "structured-criteria",
      draft_probability_threshold: Number(process.env.JEV_DRAFT_REPLY_THRESHOLD || 0.65),
    },
    run_kind: options.scope === "unclassified" ? "production" : "reprocess",
    model_requested: config.model,
    selection: {
      scope: options.scope,
      maximum: options.maximum ?? null,
      after: options.after ?? null,
      before: options.before ?? null,
      custom_email_count: options.emailIds?.length || 0,
      replace_existing: options.scope === "all" && options.resetExisting !== false,
      full_reset: fullReset,
    },
    minimum_top_probability: config.minimumTopProbability,
    concurrency: config.concurrency,
    batch_size: config.batchSize,
  });
  const queuedEmailCount = await enqueueClassificationEmails(database, run.id, selection.ids);
  return { run: await getClassificationRun(database, run.id), queuedEmailCount };
}
