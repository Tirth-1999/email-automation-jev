import type { SupabaseClient } from "@supabase/supabase-js";
import type { JevClassification } from "./jev-classifier.js";
import type {
  ClassificationRunInput,
  ClassificationRunRow,
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
    .from("email_classifications")
    .upsert(rows, { onConflict: "run_id,email_id", ignoreDuplicates: true })
    .select("id");
  assertNoError(error, "Could not enqueue emails for classification");
  await refreshClassificationRunCounters(database, runId);
  return data?.length || 0;
}

export interface ClassificationBatchOutcome {
  emailId: string;
  result?: JevClassification;
  error?: unknown;
}

export function classificationBatchRows(
  runId: string,
  outcomes: ClassificationBatchOutcome[],
  classifiedAt: string,
): Array<Record<string, unknown>> {
  return outcomes.map((outcome) => {
    if (!outcome.result) {
      return {
        run_id: runId,
        email_id: outcome.emailId,
        status: "failed",
        attempt_count: 1,
        category: null,
        category_decision: null,
        category_confidence: null,
        category_top_probability: null,
        category_probabilities: null,
        next_action: null,
        action_confidence: null,
        action_probabilities: null,
        urgency_score: null,
        urgency_confidence: null,
        urgency_probabilities: null,
        draft_probability: null,
        should_draft: null,
        model_returned: null,
        input_tokens: null,
        error_message: sanitizedClassificationError(outcome.error || "Unknown classification failure"),
        classified_at: classifiedAt,
      };
    }
    const result = outcome.result;
    return {
      run_id: runId,
      email_id: outcome.emailId,
      status: "succeeded",
      attempt_count: 1,
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
      classified_at: classifiedAt,
    };
  });
}

export async function saveClassificationBatch(
  database: DatabaseClient,
  runId: string,
  outcomes: ClassificationBatchOutcome[],
): Promise<void> {
  if (outcomes.length === 0) return;
  const classifiedAt = new Date().toISOString();
  const rows = classificationBatchRows(runId, outcomes, classifiedAt);
  const { error } = await database
    .from("email_classifications")
    .upsert(rows, { onConflict: "run_id,email_id", ignoreDuplicates: false });
  assertNoError(error, "Could not save classification batch");

  const latestFailure = [...outcomes].reverse().find((outcome) => !outcome.result);
  if (latestFailure) {
    const runResult = await database
      .from("classification_runs")
      .update({ error_message: sanitizedClassificationError(latestFailure.error) })
      .eq("id", runId)
      .eq("status", "running");
    assertNoError(runResult.error, "Could not record the latest classification error");
  }
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
    .from("classification_runs")
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
      .from("email_classifications")
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
    .from("email_classifications")
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
