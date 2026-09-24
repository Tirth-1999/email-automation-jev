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
