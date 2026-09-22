import type { SupabaseClient } from "@supabase/supabase-js";
import type { JevClassification } from "./jev-classifier.js";
import type {
  ClassificationRunInput,
  ClassificationRunRow,
  ClassifierVersionInput,
  ClassifierVersionRow,
  HumanLabelEventInput,
  HumanLabelEventRow,
  JsonObject,
  ReviewCaseInput,
  ReviewCaseRow,
} from "./classification-types.js";

type DatabaseClient = SupabaseClient;

function assertNoError(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

export function sanitizedClassificationError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
    .replace(/(api[_-]?key|token|secret|password)\s*[=:]\s*[^\s,;]+/gi, "$1=[redacted]")
    .slice(0, 2_000);
}

export async function createClassifierVersion(
  database: DatabaseClient,
  input: ClassifierVersionInput,
): Promise<ClassifierVersionRow> {
  const { data, error } = await database
    .from("classifier_versions")
    .insert({
      ...input,
      reference_config: input.reference_config || {},
      benchmark_summary: input.benchmark_summary ?? null,
    })
    .select("*")
    .single();
  assertNoError(error, "Could not create classifier version");
  return data as ClassifierVersionRow;
}

export async function findClassifierVersion(
  database: DatabaseClient,
  version: string,
): Promise<ClassifierVersionRow | null> {
  const { data, error } = await database
    .from("classifier_versions")
    .select("*")
    .eq("version", version)
    .maybeSingle();
  assertNoError(error, "Could not load classifier version");
  return data as ClassifierVersionRow | null;
}

export async function approveClassifierVersion(
  database: DatabaseClient,
  versionId: string,
  benchmarkSummary: JsonObject,
): Promise<ClassifierVersionRow> {
  const { data, error } = await database
    .from("classifier_versions")
    .update({
      status: "approved",
      benchmark_summary: benchmarkSummary,
      approved_at: new Date().toISOString(),
    })
    .eq("id", versionId)
    .eq("status", "draft")
    .select("*")
    .single();
  assertNoError(error, "Could not approve classifier version");
  return data as ClassifierVersionRow;
}

export async function createClassificationRun(
  database: DatabaseClient,
  input: ClassificationRunInput,
): Promise<ClassificationRunRow> {
  const { data, error } = await database
    .from("classification_runs")
    .insert(input)
    .select("*")
    .single();
  assertNoError(error, "Could not create classification run");
  return data as ClassificationRunRow;
}

export async function enqueueClassificationEmails(
  database: DatabaseClient,
  runId: string,
  emailIds: string[],
): Promise<number> {
  if (emailIds.length === 0) return 0;
  const rows = [...new Set(emailIds)].map((emailId) => ({ run_id: runId, email_id: emailId }));
  const { data, error } = await database
    .from("email_classification_results")
    .upsert(rows, { onConflict: "run_id,email_id", ignoreDuplicates: true })
    .select("id");
  assertNoError(error, "Could not enqueue emails for classification");
  await refreshClassificationRunCounters(database, runId);
  return data?.length || 0;
}

export async function markClassificationRunning(
  database: DatabaseClient,
  runId: string,
  emailId: string,
): Promise<boolean> {
  const current = await database
    .from("email_classification_results")
    .select("attempt_count")
    .eq("run_id", runId)
    .eq("email_id", emailId)
    .eq("status", "queued")
    .maybeSingle();
  assertNoError(current.error, "Could not inspect queued classification");
  if (!current.data) return false;
  const { data, error } = await database
    .from("email_classification_results")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      attempt_count: Number((current.data as { attempt_count: number }).attempt_count || 0) + 1,
      error_message: null,
    })
    .eq("run_id", runId)
    .eq("email_id", emailId)
    .eq("status", "queued")
    .select("id");
  assertNoError(error, "Could not mark classification as running");
  return Boolean(data?.length);
}

export async function saveClassificationResult(
  database: DatabaseClient,
  runId: string,
  emailId: string,
  result: JevClassification,
): Promise<void> {
  const { error } = await database
    .from("email_classification_results")
    .update({
      status: "succeeded",
      category: result.category,
      category_decision: result.decision,
      category_confidence: result.confidence,
      category_top_probability: result.top_probability,
      category_probabilities: result.probabilities,
      next_action: result.action.choice,
      action_confidence: result.action.confidence,
      action_probabilities: result.action.probabilities,
      urgency_score: result.urgency.score,
      urgency_confidence: result.urgency.confidence,
      urgency_probabilities: result.urgency.probabilities,
      draft_probability: result.draft_reply.probability,
      should_draft: result.draft_reply.should_draft,
      model_returned: result.model,
      input_tokens: result.input_tokens,
      error_message: null,
      classified_at: new Date().toISOString(),
    })
    .eq("run_id", runId)
    .eq("email_id", emailId)
    .eq("status", "running");
  assertNoError(error, "Could not save classification result");
}

export async function failClassificationResult(
  database: DatabaseClient,
  runId: string,
  emailId: string,
  error: unknown,
): Promise<void> {
  const errorMessage = sanitizedClassificationError(error);
  const { error: databaseError } = await database
    .from("email_classification_results")
    .update({
      status: "failed",
      error_message: errorMessage,
      classified_at: new Date().toISOString(),
    })
    .eq("run_id", runId)
    .eq("email_id", emailId)
    .eq("status", "running");
  assertNoError(databaseError, "Could not record classification failure");
  const runResult = await database
    .from("classification_runs")
    .update({ error_message: errorMessage })
    .eq("id", runId)
    .eq("status", "running");
  assertNoError(runResult.error, "Could not record the latest classification error");
}

export async function refreshClassificationRunCounters(
  database: DatabaseClient,
  runId: string,
): Promise<void> {
  const { error } = await database.rpc("refresh_classification_run_counters", {
    p_run_id: runId,
  });
  assertNoError(error, "Could not refresh classification run counters");
}

export async function requestClassificationCancellation(
  database: DatabaseClient,
  runId: string,
): Promise<void> {
  const { error } = await database
    .from("classification_runs")
    .update({ cancellation_requested_at: new Date().toISOString() })
    .eq("id", runId)
    .in("status", ["queued", "running"]);
  assertNoError(error, "Could not request classification cancellation");
}

export async function getClassificationRun(
  database: DatabaseClient,
  runId: string,
): Promise<ClassificationRunRow> {
  const { data, error } = await database
    .from("classification_runs")
    .select("*")
    .eq("id", runId)
    .single();
  assertNoError(error, "Could not load classification run");
  return data as ClassificationRunRow;
}

export async function listRecentClassificationRuns(
  database: DatabaseClient,
  limit = 20,
): Promise<ClassificationRunRow[]> {
  const { data, error } = await database
    .from("classification_run_summary")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  assertNoError(error, "Could not load classification runs");
  return (data || []) as ClassificationRunRow[];
}

export async function listQueuedClassificationEmailIds(
  database: DatabaseClient,
  runId: string,
): Promise<string[]> {
  const result: string[] = [];
  const pageSize = 1_000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await database
      .from("email_classification_results")
      .select("email_id")
      .eq("run_id", runId)
      .eq("status", "queued")
      .order("created_at")
      .range(offset, offset + pageSize - 1);
    assertNoError(error, "Could not load queued classification emails");
    const rows = (data || []) as Array<{ email_id: string }>;
    result.push(...rows.map((row) => row.email_id));
    if (rows.length < pageSize) return result;
  }
}

export async function startClassificationRun(
  database: DatabaseClient,
  runId: string,
): Promise<void> {
  const current = await getClassificationRun(database, runId);
  if (current.status === "succeeded") {
    throw new Error(`Classification run ${runId} is already terminal (${current.status})`);
  }
  const requeue = await database
    .from("email_classification_results")
    .update({ status: "queued", started_at: null })
    .eq("run_id", runId)
    .eq("status", "running");
  assertNoError(requeue.error, "Could not requeue interrupted classifications");
  const { error } = await database
    .from("classification_runs")
    .update({
      status: "running",
      started_at: current.started_at || new Date().toISOString(),
      finished_at: null,
      cancellation_requested_at: null,
      error_message: null,
    })
    .eq("id", runId)
    .in("status", ["queued", "running", "partial", "failed", "cancelled"]);
  assertNoError(error, "Could not start classification run");
}

export async function finishClassificationRun(
  database: DatabaseClient,
  runId: string,
  status: ClassificationRunRow["status"],
  errorMessage: string | null = null,
): Promise<void> {
  const { error } = await database
    .from("classification_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      error_message: errorMessage ? sanitizedClassificationError(errorMessage) : null,
    })
    .eq("id", runId);
  assertNoError(error, "Could not finish classification run");
  await refreshClassificationRunCounters(database, runId);
}

export async function appendHumanLabelEvent(
  database: DatabaseClient,
  input: HumanLabelEventInput,
): Promise<HumanLabelEventRow> {
  const { data, error } = await database
    .from("email_human_label_events")
    .insert({
      ...input,
      source_key: input.source_key ?? null,
      category: input.category ?? null,
      next_action: input.next_action ?? null,
      urgency_level: input.urgency_level ?? null,
      draft_needed: input.draft_needed ?? null,
      reviewer_id: input.reviewer_id ?? null,
      reviewer_label: input.reviewer_label ?? null,
      notes: input.notes || "",
      supersedes_event_id: input.supersedes_event_id ?? null,
    })
    .select("*")
    .single();
  assertNoError(error, "Could not append human label event");
  return data as HumanLabelEventRow;
}

export async function createClassificationReviewCase(
  database: DatabaseClient,
  input: ReviewCaseInput,
): Promise<ReviewCaseRow> {
  const { data, error } = await database
    .from("classification_review_cases")
    .insert({ ...input, classification_result_id: input.classification_result_id ?? null })
    .select("*")
    .single();
  assertNoError(error, "Could not create classification review case");
  return data as ReviewCaseRow;
}

export async function saveLlmReviewSuggestion(
  database: DatabaseClient,
  caseId: string,
  input: {
    provider: string;
    model: string;
    promptVersion: string;
    suggestion: JsonObject;
    inputTokens?: number | null;
    outputTokens?: number | null;
  },
): Promise<ReviewCaseRow> {
  const { data, error } = await database
    .from("classification_review_cases")
    .update({
      status: "llm_completed",
      llm_provider: input.provider,
      llm_model: input.model,
      llm_prompt_version: input.promptVersion,
      llm_suggestion: input.suggestion,
      llm_input_tokens: input.inputTokens ?? null,
      llm_output_tokens: input.outputTokens ?? null,
      llm_error_message: null,
      requested_at: new Date().toISOString(),
    })
    .eq("id", caseId)
    .in("status", ["pending", "llm_requested"])
    .select("*")
    .single();
  assertNoError(error, "Could not save LLM review suggestion");
  return data as ReviewCaseRow;
}
