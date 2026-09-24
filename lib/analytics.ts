import type { ClassificationRunRow } from "./classification-types.js";

export interface AnalyticsEmailRow {
  email_id: string;
  internal_date: string;
  direction: string | null;
  effective_category: string | null;
  human_category: string | null;
  human_label_source: string | null;
  jev_decision: string | null;
  category_top_probability: number | null;
  next_action: string | null;
  should_draft: boolean | null;
}

export interface RunTokenRow {
  run_id: string;
  input_tokens: number | null;
}

export interface AnalyticsBenchmark {
  classifier_version: string | null;
  generated_at: string | null;
  examples: number;
  raw_accuracy: number | null;
  automatic_coverage: number | null;
  automatic_accuracy: number | null;
  total_input_tokens: number;
  top_confusions: Array<{ expected: string; predicted: string; count: number }>;
}

export interface AnalyticsBreakdownItem {
  key: string;
  count: number;
  share: number;
}

export interface AnalyticsSnapshot {
  generated_at: string;
  period: {
    key: "30" | "60" | "90" | "all";
    label: string;
    days: number | null;
    granularity: "day" | "month";
    from: string | null;
    to: string;
  };
  summary: {
    classified_emails: number;
    needs_action: number;
    uncertain: number;
    uncertain_rate: number;
    human_corrections: number;
    human_disagreements: number;
    disagreement_rate: number | null;
    llm_confirmations: number;
    drafts_recommended: number;
  };
  category_breakdown: AnalyticsBreakdownItem[];
  action_breakdown: AnalyticsBreakdownItem[];
  confidence_breakdown: AnalyticsBreakdownItem[];
  direction_breakdown: AnalyticsBreakdownItem[];
  activity: Array<{ date: string; count: number }>;
  runs: Array<{
    id: string;
    classifier_version: string;
    status: string;
    created_at: string;
    processed_count: number;
    succeeded_count: number;
    failed_count: number;
    uncertain_count: number;
    duration_seconds: number | null;
    throughput_per_second: number | null;
    failure_rate: number | null;
    input_tokens: number;
  }>;
  benchmark: AnalyticsBenchmark | null;
}

function breakdown(values: string[], preferredOrder: string[] = []): AnalyticsBreakdownItem[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  const total = values.length;
  const order = new Map(preferredOrder.map((key, index) => [key, index]));
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count, share: total ? count / total : 0 }))
    .sort((left, right) => {
      const leftOrder = order.get(left.key) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = order.get(right.key) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || right.count - left.count || left.key.localeCompare(right.key);
    });
}

function confidenceBand(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "not_available";
  if (value < 0.6) return "low";
  if (value < 0.8) return "medium";
  return "high";
}

function safeRate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function runDuration(run: ClassificationRunRow): number | null {
  if (!run.started_at || !run.finished_at) return null;
  const seconds = (Date.parse(run.finished_at) - Date.parse(run.started_at)) / 1_000;
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

export function buildAnalyticsSnapshot(
  emails: AnalyticsEmailRow[],
  runs: ClassificationRunRow[],
  tokenRows: RunTokenRow[],
  benchmark: AnalyticsBenchmark | null,
  now = new Date(),
  period: AnalyticsSnapshot["period"] = {
    key: "30",
    label: "Last 30 days",
    days: 30,
    granularity: "day",
    from: new Date(now.getTime() - 29 * 86_400_000).toISOString(),
    to: now.toISOString(),
  },
): AnalyticsSnapshot {
  const categoryOrder = [
    "applied",
    "outreach",
    "reply_needed",
    "information_needed",
    "interview_assessment",
    "offer",
    "rejected",
    "other",
    "uncertain",
  ];
  const actionOrder = [
    "write_reply",
    "open_link",
    "fill_form",
    "schedule_interview",
    "complete_assessment",
    "send_document",
    "review_offer",
    "no_action",
    "not_available",
  ];
  const categories = emails.map((email) => email.effective_category || "uncertain");
  const actions = emails.map((email) => email.next_action || "not_available");
  const needsAction = actions.filter((action) => action !== "no_action" && action !== "not_available").length;
  const uncertain = categories.filter((category) => category === "uncertain").length;
  const corrected = emails.filter((email) => Boolean(email.human_category));
  const disagreements = corrected.filter(
    (email) => Boolean(email.jev_decision) && email.human_category !== email.jev_decision,
  ).length;
  const llmConfirmations = corrected.filter(
    (email) => email.human_label_source === "llm_review_confirmation",
  ).length;

  const tokenTotals = new Map<string, number>();
  for (const row of tokenRows) {
    tokenTotals.set(row.run_id, (tokenTotals.get(row.run_id) || 0) + (row.input_tokens || 0));
  }

  const activityCounts = new Map<string, number>();
  for (const email of emails) {
    const timestamp = Date.parse(email.internal_date);
    if (!Number.isFinite(timestamp)) continue;
    const iso = new Date(timestamp).toISOString();
    const key = period.granularity === "month" ? `${iso.slice(0, 7)}-01` : iso.slice(0, 10);
    activityCounts.set(key, (activityCounts.get(key) || 0) + 1);
  }
  const activity: Array<{ date: string; count: number }> = [];
  if (period.granularity === "month") {
    const validDates = emails.map((email) => Date.parse(email.internal_date)).filter(Number.isFinite);
    const first = validDates.length ? new Date(Math.min(...validDates)) : new Date(now);
    const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      activity.push({ date: key, count: activityCounts.get(key) || 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  } else {
    const days = period.days || 30;
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = new Date(now);
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - offset);
      const key = date.toISOString().slice(0, 10);
      activity.push({ date: key, count: activityCounts.get(key) || 0 });
    }
  }

  return {
    generated_at: now.toISOString(),
    period,
    summary: {
      classified_emails: emails.length,
      needs_action: needsAction,
      uncertain,
      uncertain_rate: emails.length ? uncertain / emails.length : 0,
      human_corrections: corrected.length,
      human_disagreements: disagreements,
      disagreement_rate: safeRate(disagreements, corrected.length),
      llm_confirmations: llmConfirmations,
      drafts_recommended: emails.filter((email) => email.should_draft === true).length,
    },
    category_breakdown: breakdown(categories, categoryOrder),
    action_breakdown: breakdown(actions, actionOrder),
    confidence_breakdown: breakdown(
      emails.map((email) => confidenceBand(email.category_top_probability)),
      ["high", "medium", "low", "not_available"],
    ),
    direction_breakdown: breakdown(
      emails.map((email) => email.direction || "unknown"),
      ["incoming", "outgoing", "unknown"],
    ),
    activity,
    runs: runs.map((run) => {
      const durationSeconds = runDuration(run);
      return {
        id: run.id,
        classifier_version: run.classifier_version,
        status: run.status,
        created_at: run.created_at,
        processed_count: run.processed_count,
        succeeded_count: run.succeeded_count,
        failed_count: run.failed_count,
        uncertain_count: run.uncertain_count,
        duration_seconds: durationSeconds,
        throughput_per_second:
          durationSeconds && durationSeconds > 0 ? run.processed_count / durationSeconds : null,
        failure_rate: safeRate(run.failed_count, run.processed_count),
        input_tokens: tokenTotals.get(run.id) || 0,
      };
    }),
    benchmark,
  };
}

export function benchmarkForAnalytics(report: Record<string, unknown>): AnalyticsBenchmark {
  const metrics = (report.metrics || {}) as Record<string, unknown>;
  const matrix = (report.confusion_matrix || {}) as Record<string, Record<string, number>>;
  const confusions: AnalyticsBenchmark["top_confusions"] = [];
  for (const [expected, predictions] of Object.entries(matrix)) {
    for (const [predicted, count] of Object.entries(predictions || {})) {
      if (expected !== predicted && count > 0) confusions.push({ expected, predicted, count });
    }
  }
  confusions.sort((left, right) => right.count - left.count);
  return {
    classifier_version: typeof report.classifier_version === "string" ? report.classifier_version : null,
    generated_at: typeof report.generated_at === "string" ? report.generated_at : null,
    examples: Number(metrics.examples || 0),
    raw_accuracy: typeof metrics.raw_accuracy === "number" ? metrics.raw_accuracy : null,
    automatic_coverage:
      typeof metrics.automatic_coverage === "number" ? metrics.automatic_coverage : null,
    automatic_accuracy:
      typeof metrics.automatic_accuracy === "number" ? metrics.automatic_accuracy : null,
    total_input_tokens: Number(metrics.total_input_tokens || 0),
    top_confusions: confusions.slice(0, 6),
  };
}
