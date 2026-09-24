import assert from "node:assert/strict";
import test from "node:test";
import { GmailIngestionOrchestrator } from "../lib/pipeline-orchestrator.js";

test("Gmail ingestion orchestrator reports progress and prevents overlapping jobs", async () => {
  const orchestrator = new GmailIngestionOrchestrator();
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const queued = orchestrator.start(async (report) => {
    report("Fetching new messages", { stage: "fetching", discovered: 3, pending: 3 });
    await gate;
    return {
      gmailAddress: "person@example.com",
      mailboxTotal: 100,
      syncType: "incremental",
      historyId: "history-2",
      counts: { discovered: 3, inserted: 2, updated: 1, deleted: 0, skipped: 0 },
    };
  });

  assert.equal(queued.status, "queued");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(orchestrator.current()?.stats.discovered, 3);
  assert.throws(() => orchestrator.start(async () => { throw new Error("not reached"); }), /already running/);
  release?.();
  const completed = await orchestrator.waitForCompletion();
  assert.equal(completed?.status, "succeeded");
  assert.equal(completed?.result?.counts.inserted, 2);
  assert.equal(completed?.message, "Imported 2 new emails");
});

test("Gmail ingestion orchestrator exposes a safe failed state", async () => {
  const orchestrator = new GmailIngestionOrchestrator();
  orchestrator.start(async () => { throw new Error("OAuth token expired"); });
  const completed = await orchestrator.waitForCompletion();
  assert.equal(completed?.status, "failed");
  assert.match(completed?.error || "", /OAuth token expired/);
});

test("Gmail ingestion cancellation stops at the next progress checkpoint", async () => {
  const orchestrator = new GmailIngestionOrchestrator();
  let continueWork: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { continueWork = resolve; });
  orchestrator.start(async (report) => {
    report("Fetching page one", { stage: "fetching", page: 1 });
    await gate;
    report("Fetching page two", { stage: "fetching", page: 2 });
    throw new Error("not reached");
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(orchestrator.cancel(), true);
  assert.match(orchestrator.current()?.message || "", /Stopping Gmail sync/);
  continueWork?.();
  const completed = await orchestrator.waitForCompletion();

  assert.equal(completed?.status, "cancelled");
  assert.equal(completed?.error, null);
  assert.equal(completed?.message, "Gmail sync cancelled");
  assert.equal(orchestrator.cancel(), false);
});
