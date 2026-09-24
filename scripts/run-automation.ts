import "dotenv/config";
import { loadIngestionConfig } from "../lib/config.js";
import { createGmailClient, getGmailProfile } from "../lib/gmail.js";
import { GmailRequestController } from "../lib/gmail-rate-limit.js";
import { runIngestion } from "../lib/ingest.js";
import { materializeApplications } from "../lib/application-materializer.js";
import {
  createProductionClassificationRun,
  previewClassificationSelection,
  runClassification,
  validateClassificationConfig,
  type ClassificationWorkerConfig,
} from "../lib/classification-worker.js";
import {
  acquirePipelineLease,
  jsonOperationsLogger,
  millisecondsUntilNextInterval,
  releasePipelineLease,
  runAutomationCycle,
  sendOperationsFailureWebhook,
} from "../lib/operations.js";
import { createDatabaseClient, ensureGmailAccount } from "../lib/repository.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value === "replace_me") throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function integer(name: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number.parseInt(process.env[name]?.trim() || String(fallback), 10);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

const database = createDatabaseClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"));
const intervalMinutes = integer("AUTOMATION_INTERVAL_MINUTES", 60, 5, 1440);
const lockTtlSeconds = integer("AUTOMATION_LOCK_TTL_SECONDS", 10800, 60, 21600);
const classificationConfig: ClassificationWorkerConfig = {
  model: process.env.TYPESAFE_MODEL?.trim() || "jev-1.13.0",
  minimumTopProbability: Number(process.env.JEV_MIN_TOP_PROBABILITY || "0.6"),
  concurrency: integer("AUTOMATION_JEV_CONCURRENCY", 5, 1, 250),
  batchSize: integer("AUTOMATION_JEV_BATCH_SIZE", 25, 1, 1_000),
  maxRetries: integer("AUTOMATION_JEV_MAX_RETRIES", 6, 0, 6),
};
validateClassificationConfig(classificationConfig);

async function primaryAccount(): Promise<{ id: string }> {
  const { data, error } = await database
    .from("gmail_accounts")
    .select("id")
    .order("created_at")
    .limit(1);
  if (error) throw new Error(`Could not load Gmail account: ${error.message}`);
  const account = (data || [])[0] as { id: string } | undefined;
  if (!account) throw new Error("No Gmail account exists. Run `npm run ingest` once before enabling automation.");
  return account;
}

async function executeCycle() {
  const account = await primaryAccount();
  const webhook = process.env.OPERATIONS_ALERT_WEBHOOK_URL?.trim() || "";
  return runAutomationCycle({
    acquire: (cycleId) => acquirePipelineLease(database, account.id, cycleId, lockTtlSeconds),
    release: (cycleId, status, error, metrics) =>
      releasePipelineLease(database, account.id, cycleId, status, error, metrics),
    ingest: async () => {
      const config = await loadIngestionConfig();
      const gmail = createGmailClient({ ...config.oauth, refreshToken: config.refreshToken });
      const requests = new GmailRequestController({
        requestsPerSecond: config.requestsPerSecond,
        maxRetries: config.maxRetries,
        onRetry: ({ operation, attempt, maxRetries, delayMs, reason }) => {
          jsonOperationsLogger({
            timestamp: new Date().toISOString(),
            level: "warn",
            event: "gmail_request_retry",
            operation,
            attempt,
            max_retries: maxRetries,
            delay_ms: delayMs,
            reason: reason.slice(0, 500),
          });
        },
      });
      const profile = await getGmailProfile(gmail, requests);
      const gmailAccount = await ensureGmailAccount(database, profile.emailAddress);
      if (gmailAccount.id !== account.id) throw new Error("Scheduled Gmail identity does not match the configured account");
      const result = await runIngestion({
        database,
        gmail,
        requests,
        account: gmailAccount,
        profileHistoryId: profile.historyId,
        forceFull: false,
        resumeFull: false,
        query: config.gmailQuery,
        includeSpamTrash: config.includeSpamTrash,
        includeOutgoing: config.includeOutgoing,
        maxMessages: config.maxMessages,
        fetchConcurrency: config.fetchConcurrency,
        upsertBatchSize: config.upsertBatchSize,
      });
      return {
        discovered: result.counts.discovered,
        inserted: result.counts.inserted,
        updated: result.counts.updated,
      };
    },
    classify: async () => {
      const preview = await previewClassificationSelection(
        database,
        account.id,
        { scope: "unclassified" },
        classificationConfig.batchSize,
      );
      if (preview.selected_count === 0) return { classified: 0, failed: 0 };
      required("TYPESAFE_API_KEY");
      const created = await createProductionClassificationRun(
        database,
        account.id,
        { scope: "unclassified" },
        classificationConfig,
      );
      const completed = await runClassification(database, created.run.id, classificationConfig);
      return { classified: completed.succeeded_count, failed: completed.failed_count };
    },
    publish: async () => {
      const result = await materializeApplications(database);
      return { applications: result.application_count };
    },
    ...(webhook
      ? { notifyFailure: (result: Parameters<typeof sendOperationsFailureWebhook>[1]) => sendOperationsFailureWebhook(webhook, result) }
      : {}),
  });
}

async function runAndReport(): Promise<void> {
  const result = await executeCycle();
  jsonOperationsLogger({
    timestamp: new Date().toISOString(),
    level: result.status === "failed" ? "error" : result.status === "skipped" ? "warn" : "info",
    event: "automation_cycle_result",
    cycle_id: result.cycleId,
    stage: result.stage,
    status: result.status,
    metrics: result.metrics,
    error: result.error,
  });
  if (result.status === "failed") process.exitCode = 1;
}

if (!process.argv.includes("--watch")) {
  await runAndReport();
} else {
  let stopped = false;
  const stop = () => { stopped = true; };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  await runAndReport();
  while (!stopped) {
    const delay = millisecondsUntilNextInterval(new Date(), intervalMinutes);
    jsonOperationsLogger({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "automation_waiting",
      interval_minutes: intervalMinutes,
      next_run_at: new Date(Date.now() + delay).toISOString(),
    });
    await new Promise<void>((resolve) => {
      let poll: ReturnType<typeof setInterval>;
      const timeout = setTimeout(() => {
        clearInterval(poll);
        resolve();
      }, delay);
      poll = setInterval(() => {
        if (!stopped) return;
        clearInterval(poll);
        clearTimeout(timeout);
        resolve();
      }, 500);
      timeout.unref?.();
    });
    if (!stopped) await runAndReport();
  }
}
