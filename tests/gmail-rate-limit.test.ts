import assert from "node:assert/strict";
import test from "node:test";
import {
  GmailRequestController,
  isRetryableGmailError,
} from "../lib/gmail-rate-limit.js";

function quotaError() {
  return {
    code: 403,
    response: {
      status: 403,
      data: {
        error: {
          message: "Quota exceeded for quota metric 'Total Query Cost'",
          errors: [{ reason: "userRateLimitExceeded" }],
        },
      },
    },
  };
}

test("recognizes Gmail quota and transient server errors as retryable", () => {
  assert.equal(isRetryableGmailError(quotaError()), true);
  assert.equal(isRetryableGmailError({ code: 429 }), true);
  assert.equal(isRetryableGmailError({ response: { status: 503 } }), true);
  assert.equal(
    isRetryableGmailError({
      code: 403,
      response: {
        status: 403,
        data: { error: { errors: [{ reason: "domainPolicy" }] } },
      },
    }),
    false,
  );
});
test("retries quota failures with exponential backoff", async () => {
  let clock = 0;
  const sleeps: number[] = [];
  const notices: number[] = [];
  let calls = 0;
  const controller = new GmailRequestController({
    requestsPerSecond: 1_000,
    maxRetries: 3,
    baseDelayMs: 1_000,
    random: () => 0,
    now: () => clock,
    sleep: async (milliseconds) => {
      sleeps.push(milliseconds);
      clock += milliseconds;
    },
    onRetry: ({ attempt }) => notices.push(attempt),
  });

  const result = await controller.run("users.messages.get", async () => {
    calls += 1;
    if (calls < 3) throw quotaError();
    return "ok";
  });

  assert.equal(result, "ok");
  assert.equal(calls, 3);
  assert.deepEqual(notices, [1, 2]);
  assert.deepEqual(sleeps, [1_000, 2_000]);
});

test("paces successful requests at the configured request rate", async () => {
  let clock = 0;
  const sleeps: number[] = [];
  const controller = new GmailRequestController({
    requestsPerSecond: 4,
    maxRetries: 0,
    now: () => clock,
    sleep: async (milliseconds) => {
      sleeps.push(milliseconds);
      clock += milliseconds;
    },
  });

  await controller.run("first", async () => "first");
  await controller.run("second", async () => "second");

  assert.deepEqual(sleeps, [250]);
});
