import { randomUUID } from "node:crypto";
import type { IngestionLiveStats, IngestionResult } from "./ingest.js";

export type PipelineJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface IngestionExecutionResult extends IngestionResult {
  gmailAddress: string;
  mailboxTotal: number | null;
}

export interface IngestionJobSnapshot {
  id: string;
  status: PipelineJobStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  message: string;
  stats: IngestionLiveStats;
  result: IngestionExecutionResult | null;
  error: string | null;
  cancellation_requested_at: string | null;
}

export type IngestionProgressReporter = (
  message: string,
  stats?: Partial<IngestionLiveStats>,
) => void;

export type IngestionExecutor = (
  report: IngestionProgressReporter,
) => Promise<IngestionExecutionResult>;

function initialStats(): IngestionLiveStats {
  return {
    stage: "starting",
    page: 0,
    iteration: 0,
    discovered: 0,
    existing: 0,
    pending: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    deleted: 0,
  };
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 2_000);
}

export class GmailIngestionOrchestrator {
  private job: IngestionJobSnapshot | null = null;
  private activeTask: Promise<void> | null = null;

  isRunning(): boolean {
    return this.activeTask !== null;
  }

  current(): IngestionJobSnapshot | null {
    return this.job ? structuredClone(this.job) : null;
  }

  async waitForCompletion(): Promise<IngestionJobSnapshot | null> {
    await this.activeTask;
    return this.current();
  }

  cancel(): boolean {
    if (!this.activeTask || !this.job) return false;
    this.job.cancellation_requested_at ||= new Date().toISOString();
    this.job.message = "Stopping Gmail sync after the current request";
    return true;
  }

  start(execute: IngestionExecutor): IngestionJobSnapshot {
    if (this.activeTask) throw new Error("A Gmail ingestion job is already running");
    const now = new Date().toISOString();
    this.job = {
      id: randomUUID(),
      status: "queued",
      created_at: now,
      started_at: null,
      finished_at: null,
      message: "Queued Gmail incremental sync",
      stats: initialStats(),
      result: null,
      error: null,
      cancellation_requested_at: null,
    };
    const job = this.job;
    this.activeTask = Promise.resolve()
      .then(async () => {
        if (job.cancellation_requested_at) throw new Error("INGESTION_CANCELLED");
        job.status = "running";
        job.started_at = new Date().toISOString();
        job.message = "Connecting to Gmail";
        const result = await execute((message, stats = {}) => {
          if (job.cancellation_requested_at) throw new Error("INGESTION_CANCELLED");
          job.message = message;
          job.stats = { ...job.stats, ...stats };
        });
        if (job.cancellation_requested_at) throw new Error("INGESTION_CANCELLED");
        job.result = result;
        job.stats = { ...job.stats, ...result.counts, stage: "finalizing", pending: 0 };
        job.status = "succeeded";
        job.message = result.counts.inserted
          ? `Imported ${result.counts.inserted} new email${result.counts.inserted === 1 ? "" : "s"}`
          : "Mailbox is already up to date";
      })
      .catch((error: unknown) => {
        if (job.cancellation_requested_at) {
          job.status = "cancelled";
          job.error = null;
          job.message = "Gmail sync cancelled";
          return;
        }
        job.status = "failed";
        job.error = errorMessage(error);
        job.message = `Gmail sync failed: ${job.error}`;
      })
      .finally(() => {
        job.finished_at = new Date().toISOString();
        this.activeTask = null;
      });
    return this.current() as IngestionJobSnapshot;
  }
}
