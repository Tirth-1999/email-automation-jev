import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBattlegroundMetrics,
  percentile,
  randomSample,
  summarizeBattlegroundDecisions,
  validateBattlegroundConfig,
  type BattlegroundConfig,
  type BattlegroundResult,
} from "../lib/battleground.js";

function config(overrides: Partial<BattlegroundConfig> = {}): BattlegroundConfig {
  return {
    sampleSize: 50,
    concurrency: 5,
    model: "jev-1.13.0",
    minimumTopProbability: 0.6,
    maxRetries: 2,
    ...overrides,
  };
}

function result(jevMs: number, overheadMs: number): BattlegroundResult {
  return {
    email_id: crypto.randomUUID(),
    gmail_message_id: "gmail-id",
    subject: "Subject",
    sender: "Sender",
    snippet: "Snippet",
    status: "succeeded",
    category: "applied",
    decision: "applied",
    action: "no_action",
    top_probability: 0.9,
    input_tokens: 100,
    database_ms: overheadMs,
    jev_ms: jevMs,
    worker_ms: jevMs + overheadMs,
    application_overhead_ms: overheadMs,
    error_type: null,
    http_status: null,
    error: null,
  };
}

test("Battleground validates cost and concurrency bounds", () => {
  assert.doesNotThrow(() => validateBattlegroundConfig(config()));
  assert.throws(() => validateBattlegroundConfig(config({ sampleSize: 0 })), /1 to 6000/);
  assert.doesNotThrow(() => validateBattlegroundConfig(config({ sampleSize: 6_000 })));
  assert.throws(() => validateBattlegroundConfig(config({ sampleSize: 6_001 })), /1 to 6000/);
  assert.doesNotThrow(() => validateBattlegroundConfig(config({ concurrency: 500 })));
  assert.throws(() => validateBattlegroundConfig(config({ concurrency: 501 })), /1 to 500/);
});

test("random sample is unique and does not mutate the source", () => {
  const source = [1, 2, 3, 4, 5];
  const sample = randomSample(source, 3, () => 0.25);
  assert.equal(sample.length, 3);
  assert.equal(new Set(sample).size, 3);
  assert.deepEqual(source, [1, 2, 3, 4, 5]);
});

test("Battleground metrics separate provider latency and app overhead", () => {
  const metrics = calculateBattlegroundMetrics(
    [result(100, 10), result(200, 20), result(300, 30), result(400, 40)],
    1_000,
    50,
    50,
    6_000,
  );
  assert.equal(metrics.email_load_ms, 50);
  assert.equal(metrics.classification_ms, 900);
  assert.equal(metrics.throughput_per_second, 4.4);
  assert.equal(metrics.successful_throughput_per_second, 4.4);
  assert.equal(metrics.success_rate, 1);
  assert.equal(metrics.rate_limited_count, 0);
  assert.equal(metrics.average_jev_ms, 250);
  assert.equal(metrics.p50_jev_ms, 200);
  assert.equal(metrics.p95_jev_ms, 400);
  assert.equal(metrics.average_application_overhead_ms, 25);
  assert.equal(metrics.projected_mailbox_seconds, 1_425.1);
  assert.equal(metrics.total_input_tokens, 400);
});

test("Battleground success rate preserves visible partial failures", () => {
  const failed = { ...result(120, 4), status: "failed" as const, category: null, decision: null };
  const metrics = calculateBattlegroundMetrics(
    [...Array.from({ length: 119 }, () => result(100, 2)), failed],
    2_000,
    50,
    50,
    6_000,
  );
  assert.equal(metrics.success_rate, 0.9917);
});

test("Battleground decision summary groups categories and confidence bands", () => {
  const appliedHigh = { ...result(100, 2), category: "applied", decision: "applied", top_probability: 0.91 };
  const appliedMedium = { ...result(110, 2), category: "applied", decision: "applied", top_probability: 0.72 };
  const outreachLow = { ...result(120, 2), category: "outreach", decision: "outreach", top_probability: 0.52 };
  const failed = { ...result(20, 1), status: "failed" as const, category: null, decision: null, top_probability: null };
  const summary = summarizeBattlegroundDecisions([appliedHigh, appliedMedium, outreachLow, failed]);

  assert.deepEqual(summary[0], {
    category: "applied",
    count: 2,
    average_confidence: 0.815,
    low_confidence_count: 0,
    medium_confidence_count: 1,
    high_confidence_count: 1,
  });
  assert.equal(summary.find((item) => item.category === "outreach")?.low_confidence_count, 1);
  assert.equal(summary.find((item) => item.category === "failed")?.count, 1);
});

test("percentile handles empty and tail values", () => {
  assert.equal(percentile([], 0.95), 0);
  assert.equal(percentile([10, 20, 30, 40], 0.5), 20);
  assert.equal(percentile([10, 20, 30, 40], 0.95), 40);
});
