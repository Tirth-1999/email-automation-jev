import type { ActionType, JevCategory } from "./jev-classifier.js";

export type JsonObject = Record<string, unknown>;
export type ClassifierVersionStatus = "draft" | "approved" | "retired";
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
export type ReviewReason = "low_confidence" | "human_disagreement" | "manual_override" | "processing_issue";
export type ReviewStatus = "pending" | "llm_requested" | "llm_completed" | "resolved" | "dismissed";

export interface ClassifierVersionInput {
  version: string;
  model_requested: string;
  question_config: JsonObject;
  composition_policy: JsonObject;
  source_dataset_version: string;
  reference_config?: JsonObject;
  benchmark_summary?: JsonObject | null;
}

export interface ClassifierVersionRow extends ClassifierVersionInput {
  id: string;
  status: ClassifierVersionStatus;
  reference_config: JsonObject;
  benchmark_summary: JsonObject | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassificationRunInput {
  gmail_account_id: string;
  classifier_version_id: string;
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

export interface HumanLabelEventInput {
  email_id: string;
  source_key?: string | null;
  category?: HumanCategory | null;
  next_action?: ActionType | null;
  urgency_level?: HumanUrgencyLevel | null;
  draft_needed?: boolean | null;
  source: HumanLabelSource;
  reviewer_id?: string | null;
  reviewer_label?: string | null;
  notes?: string;
  supersedes_event_id?: string | null;
}

export interface HumanLabelEventRow extends HumanLabelEventInput {
  id: string;
  source_key: string | null;
  category: HumanCategory | null;
  next_action: ActionType | null;
  urgency_level: HumanUrgencyLevel | null;
  draft_needed: boolean | null;
  reviewer_id: string | null;
  reviewer_label: string | null;
  notes: string;
  supersedes_event_id: string | null;
  created_at: string;
}

export interface ReviewCaseInput {
  email_id: string;
  classification_result_id?: string | null;
  reason: ReviewReason;
  jev_snapshot: JsonObject;
}

export interface ReviewCaseRow extends ReviewCaseInput {
  id: string;
  status: ReviewStatus;
  classification_result_id: string | null;
  llm_provider: string | null;
  llm_model: string | null;
  llm_prompt_version: string | null;
  llm_suggestion: JsonObject | null;
  llm_input_tokens: number | null;
  llm_output_tokens: number | null;
  llm_error_message: string | null;
  final_label_event_id: string | null;
  reviewer_id: string | null;
  reviewer_label: string | null;
  resolution_notes: string;
  requested_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}
