import type { ActionType, JevCategory } from "./jev-classifier.js";

export type JsonObject = Record<string, unknown>;
export type ClassificationRunKind = "benchmark" | "diagnostic" | "production" | "reprocess";
export type ClassificationRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "partial"
  | "failed"
  | "cancelled";
export type ClassificationResultStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type HumanCategory = JevCategory | "uncertain";
export type HumanUrgencyLevel = "none" | "low" | "normal" | "high" | "immediate";
export type HumanLabelSource = "review_ui" | "board_override" | "llm_review_confirmation";

export interface ClassificationRunInput {
  gmail_account_id: string;
  classifier_version: string;
  classifier_config: JsonObject;
  run_kind: ClassificationRunKind;
  model_requested: string;
  selection: JsonObject;
  minimum_top_probability: number;
  concurrency: number;
  batch_size: number;
}

export interface ClassificationRunRow extends ClassificationRunInput {
  id: string;
  status: ClassificationRunStatus;
  total_count: number;
  processed_count: number;
  succeeded_count: number;
  failed_count: number;
  uncertain_count: number;
  cancellation_requested_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface HumanLabelInput {
  email_id: string;
  source_key?: string | null;
  category?: HumanCategory | null;
  next_action?: ActionType | null;
  urgency_level?: HumanUrgencyLevel | null;
  draft_needed?: boolean | null;
  source: HumanLabelSource;
  notes?: string;
}
