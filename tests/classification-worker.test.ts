import assert from "node:assert/strict";
import test from "node:test";
import {
  mapConcurrent,
  terminalRunStatus,
  validateClassificationConfig,
  validateSelectionOptions,
  type ClassificationWorkerConfig,
} from "../lib/classification-worker.js";

function config(overrides: Partial<ClassificationWorkerConfig> = {}): ClassificationWorkerConfig {
  return {
    model: "jev-1.13.0",
    minimumTopProbability: 0.6,
    concurrency: 5,
    batchSize: 25,
    maxRetries: 6,
    ...overrides,
  };
}

test("worker configuration enforces production safety bounds", () => {
  assert.doesNotThrow(() => validateClassificationConfig(config()));
  assert.doesNotThrow(() => validateClassificationConfig(config({ concurrency: 250, batchSize: 1_000 })));
  assert.throws(() => validateClassificationConfig(config({ concurrency: 0 })), /1 to 250/);
  assert.throws(() => validateClassificationConfig(config({ concurrency: 251 })), /1 to 250/);
  assert.throws(() => validateClassificationConfig(config({ batchSize: 1_001 })), /1 to 1000/);
  assert.throws(() => validateClassificationConfig(config({ maxRetries: 7 })), /0 to 6/);
  assert.throws(
    () => validateClassificationConfig(config({ minimumTopProbability: 1.1 })),
    /between 0 and 1/,
  );
});

test("a destructive all-scope run cannot rebuild only part of the mailbox", () => {
  assert.doesNotThrow(() => validateSelectionOptions({ scope: "all" }));
  assert.doesNotThrow(() => validateSelectionOptions({ scope: "all", resetExisting: false }));
  assert.throws(
    () => validateSelectionOptions({ scope: "all", maximum: 25 }),
    /cannot be combined with limit, date, or email-id filters/,
  );
  assert.throws(() => validateSelectionOptions({ scope: "all", after: "2026-01-01" }), /full-mailbox/);
  assert.throws(
    () => validateSelectionOptions({ scope: "unclassified", resetExisting: true }),
    /requires the entire-mailbox scope/,
  );
  assert.doesNotThrow(() => validateSelectionOptions({ scope: "unclassified", maximum: 25 }));
});

test("bounded mapper never exceeds configured concurrency", async () => {
  let active = 0;
  let maximumActive = 0;
  const completed: number[] = [];
  await mapConcurrent([1, 2, 3, 4, 5, 6, 7], 3, async (value) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    completed.push(value);
    active -= 1;
  });
  assert.equal(maximumActive, 3);
  assert.deepEqual([...completed].sort((left, right) => left - right), [1, 2, 3, 4, 5, 6, 7]);
});

test("run outcome preserves partial success and cancellation", () => {
  assert.equal(terminalRunStatus({ succeeded_count: 8, failed_count: 0 }, false), "succeeded");
  assert.equal(terminalRunStatus({ succeeded_count: 8, failed_count: 2 }, false), "partial");
  assert.equal(terminalRunStatus({ succeeded_count: 0, failed_count: 2 }, false), "failed");
  assert.equal(terminalRunStatus({ succeeded_count: 4, failed_count: 1 }, true), "cancelled");
});
