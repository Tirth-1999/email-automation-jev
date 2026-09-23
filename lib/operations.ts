import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AutomationStatus = "succeeded" | "failed" | "skipped";
export type AutomationStage = "lock" | "ingestion" | "classification" | "publication" | "complete";

export interface AutomationMetrics {
  cycle_id: string;
  duration_ms: number;
  ingestion_ms: number;
  classification_ms: number;
  publication_ms: number;
  emails_discovered: number;
  emails_inserted: number;
  emails_updated: number;
  emails_classified: number;
  classification_failures: number;
  applications_published: number;
}

export interface AutomationCycleResult {
  status: AutomationStatus;
  stage: AutomationStage;
  cycleId: string;
  startedAt: string;
  finishedAt: string;
  metrics: AutomationMetrics;
  error: string | null;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  event: string;
  cycle_id?: string;
  stage?: AutomationStage;
  duration_ms?: number;
  [key: string]: unknown;
}

export type OperationsLogger = (entry: StructuredLogEntry) => void;

export interface AutomationDependencies {
  acquire(cycleId: string): Promise<boolean>;
  release(cycleId: string, status: AutomationStatus, error: string | null, metrics: AutomationMetrics): Promise<void>;
  ingest(): Promise<{ discovered: number; inserted: number; updated: number }>;
  classify(): Promise<{ classified: number; failed: number }>;
  publish(): Promise<{ applications: number }>;
  notifyFailure?(result: AutomationCycleResult): Promise<void>;
  logger?: OperationsLogger;
  now?: () => Date;
}

const EMPTY_METRICS = (cycleId: string): AutomationMetrics => ({
  cycle_id: cycleId,
  duration_ms: 0,
  ingestion_ms: 0,
  classification_ms: 0,
  publication_ms: 0,
  emails_discovered: 0,
  emails_inserted: 0,
  emails_updated: 0,
  emails_classified: 0,
  classification_failures: 0,
  applications_published: 0,
});

export function sanitizedOperationsError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
    .replace(/(api[_-]?key|token|password|secret)=([^\s&]+)/gi, "$1=[redacted]")
    .slice(0, 2_000);
}

export function jsonOperationsLogger(entry: StructuredLogEntry): void {
  // Structured entries intentionally contain counts, durations, stages, and
  // opaque run identifiers only. Email headers and bodies are never logged.
  const output = JSON.stringify(entry);
  if (entry.level === "error") console.error(output);
  else if (entry.level === "warn") console.warn(output);
  else console.log(output);
}

export function millisecondsUntilNextInterval(
  now: Date,
  intervalMinutes: number,
): number {
  if (!Number.isInteger(intervalMinutes) || intervalMinutes < 1) {
    throw new Error("intervalMinutes must be a positive integer");
  }
  const intervalMs = intervalMinutes * 60_000;
  return intervalMs - (now.getTime() % intervalMs);
}

export async function acquirePipelineLease(
  database: SupabaseClient,
  accountId: string,
  cycleId: string,
  ttlSeconds: number,
): Promise<boolean> {
  const { data, error } = await database.rpc("try_acquire_pipeline_lock", {
    p_account_id: accountId,
    p_lock_id: cycleId,
    p_ttl_seconds: ttlSeconds,
  });
  if (error) throw new Error(`Could not acquire pipeline lock. Apply migration 007 first. ${error.message}`);
  return data === true;
}

export async function releasePipelineLease(
  database: SupabaseClient,
  accountId: string,
  cycleId: string,
  status: AutomationStatus,
  errorMessage: string | null,
  metrics: AutomationMetrics,
): Promise<void> {
  const { data, error } = await database.rpc("release_pipeline_lock", {
    p_account_id: accountId,
    p_lock_id: cycleId,
    p_status: status,
    p_error: errorMessage,
    p_metrics: metrics,
  });
  if (error) throw new Error(`Could not release pipeline lock: ${error.message}`);
  if (data !== true) throw new Error("Pipeline lock expired or changed before release");
}

export async function sendOperationsFailureWebhook(
  webhookUrl: string,
  result: AutomationCycleResult,
): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "email_automation_pipeline_failed",
      cycle_id: result.cycleId,
      stage: result.stage,
      started_at: result.startedAt,
      finished_at: result.finishedAt,
      error: result.error,
      metrics: result.metrics,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Failure webhook returned HTTP ${response.status}`);
}

export async function runAutomationCycle(
  dependencies: AutomationDependencies,
): Promise<AutomationCycleResult> {
  const now = dependencies.now || (() => new Date());
  const logger = dependencies.logger || jsonOperationsLogger;
  const cycleId = randomUUID();
  const startedAt = now();
  const metrics = EMPTY_METRICS(cycleId);
  let stage: AutomationStage = "lock";
  let acquired = false;
  const log = (level: StructuredLogEntry["level"], event: string, fields: Record<string, unknown> = {}) =>
    logger({ timestamp: now().toISOString(), level, event, cycle_id: cycleId, stage, ...fields });

  try {
    acquired = await dependencies.acquire(cycleId);
    if (!acquired) {
      const finishedAt = now();
      metrics.duration_ms = Math.max(0, finishedAt.getTime() - startedAt.getTime());
      log("warn", "automation_cycle_skipped", { reason: "pipeline_busy" });
      return {
        status: "skipped",
        stage,
        cycleId,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        metrics,
        error: "Another sync or classification job is active",
      };
    }

    log("info", "automation_cycle_started");
    stage = "ingestion";
    let stageStarted = now();
    const ingestion = await dependencies.ingest();
    metrics.ingestion_ms = Math.max(0, now().getTime() - stageStarted.getTime());
    metrics.emails_discovered = ingestion.discovered;
    metrics.emails_inserted = ingestion.inserted;
    metrics.emails_updated = ingestion.updated;
    log("info", "automation_ingestion_completed", { duration_ms: metrics.ingestion_ms, ...ingestion });

    stage = "classification";
    stageStarted = now();
    const classification = await dependencies.classify();
    metrics.classification_ms = Math.max(0, now().getTime() - stageStarted.getTime());
    metrics.emails_classified = classification.classified;
    metrics.classification_failures = classification.failed;
    log("info", "automation_classification_completed", { duration_ms: metrics.classification_ms, ...classification });

    stage = "publication";
    stageStarted = now();
    const publication = await dependencies.publish();
    metrics.publication_ms = Math.max(0, now().getTime() - stageStarted.getTime());
    metrics.applications_published = publication.applications;
    log("info", "automation_publication_completed", { duration_ms: metrics.publication_ms, ...publication });

    stage = "complete";
    const finishedAt = now();
    metrics.duration_ms = Math.max(0, finishedAt.getTime() - startedAt.getTime());
    await dependencies.release(cycleId, "succeeded", null, metrics);
    log("info", "automation_cycle_completed", { duration_ms: metrics.duration_ms });
    return {
      status: "succeeded",
      stage,
      cycleId,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      metrics,
      error: null,
    };
  } catch (error) {
    const message = sanitizedOperationsError(error);
    const finishedAt = now();
    metrics.duration_ms = Math.max(0, finishedAt.getTime() - startedAt.getTime());
    const result: AutomationCycleResult = {
      status: "failed",
      stage,
      cycleId,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      metrics,
      error: message,
    };
    if (acquired) {
      try {
        await dependencies.release(cycleId, "failed", message, metrics);
      } catch (releaseError) {
        log("error", "automation_lock_release_failed", {
          error: sanitizedOperationsError(releaseError),
        });
      }
    }
    log("error", "automation_cycle_failed", { error: message, duration_ms: metrics.duration_ms });
    if (dependencies.notifyFailure) {
      try {
        await dependencies.notifyFailure(result);
      } catch (notificationError) {
        log("error", "automation_failure_notification_failed", {
          error: sanitizedOperationsError(notificationError),
        });
      }
    }
    return result;
  }
}
