import assert from "node:assert/strict";
import test from "node:test";
import { benchmarkForAnalytics, buildAnalyticsSnapshot } from "../lib/analytics.js";
import type { ClassificationRunRow } from "../lib/classification-types.js";

const run: ClassificationRunRow = {
  id: "run-1",
  gmail_account_id: "account-1",
  classifier_version: "job-email-jev-v4",
  classifier_config: {},
  run_kind: "production",
  model_requested: "jev-test",
  selection: {},
  minimum_top_probability: 0.6,
  concurrency: 5,
  batch_size: 25,
  status: "succeeded",
  total_count: 2,
  processed_count: 2,
  succeeded_count: 1,
  failed_count: 1,
  uncertain_count: 1,
  cancellation_requested_at: null,
  started_at: "2026-09-22T12:00:00.000Z",
  finished_at: "2026-09-22T12:00:02.000Z",
  error_message: null,
  created_at: "2026-09-22T12:00:00.000Z",
  updated_at: "2026-09-22T12:00:02.000Z",
};

test("analytics aggregates decisions, corrections, runs, and token usage", () => {
  const snapshot = buildAnalyticsSnapshot(
    [
      {
        email_id: "email-1",
        internal_date: "2026-09-22T09:00:00.000Z",
        direction: "incoming",
        effective_category: "reply_needed",
        human_category: "reply_needed",
        human_label_source: "board_override",
        jev_decision: "applied",
        category_top_probability: 0.88,
        next_action: "write_reply",
        should_draft: true,
      },
      {
        email_id: "email-2",
        internal_date: "2026-09-21T09:00:00.000Z",
        direction: "incoming",
        effective_category: "uncertain",
        human_category: null,
        human_label_source: null,
        jev_decision: "uncertain",
        category_top_probability: 0.52,
        next_action: "no_action",
        should_draft: false,
      },
    ],
    [run],
    [
      { run_id: "run-1", input_tokens: 120 },
      { run_id: "run-1", input_tokens: 80 },
    ],
    null,
    new Date("2026-09-22T18:00:00.000Z"),
  );

  assert.equal(snapshot.summary.classified_emails, 2);
  assert.equal(snapshot.summary.needs_action, 1);
  assert.equal(snapshot.summary.uncertain_rate, 0.5);
  assert.equal(snapshot.summary.human_disagreements, 1);
  assert.equal(snapshot.summary.drafts_recommended, 1);
  const firstRun = snapshot.runs[0];
  assert.ok(firstRun);
  assert.equal(firstRun.duration_seconds, 2);
  assert.equal(firstRun.throughput_per_second, 1);
  assert.equal(firstRun.input_tokens, 200);
  assert.equal(snapshot.activity.at(-1)?.count, 1);
});

test("benchmark analytics excludes correct predictions from confusion ranking", () => {
  const benchmark = benchmarkForAnalytics({
    classifier_version: "job-email-jev-v4",
    generated_at: "2026-09-22T00:00:00.000Z",
    metrics: {
      examples: 10,
      raw_accuracy: 0.8,
      automatic_coverage: 0.9,
      automatic_accuracy: 0.88,
      total_input_tokens: 1234,
    },
    confusion_matrix: {
      applied: { applied: 7, other: 2 },
      rejected: { rejected: 1, applied: 3 },
    },
  });

  assert.equal(benchmark.examples, 10);
  assert.deepEqual(benchmark.top_confusions[0], {
    expected: "rejected",
    predicted: "applied",
    count: 3,
  });
  assert.equal(benchmark.top_confusions.some((item) => item.expected === item.predicted), false);
});
