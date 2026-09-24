import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  millisecondsUntilNextInterval,
  runAutomationCycle,
  sanitizedOperationsError,
  type StructuredLogEntry,
} from "../lib/operations.js";

test("hourly alignment returns the next wall-clock boundary", () => {
  assert.equal(millisecondsUntilNextInterval(new Date("2026-09-23T03:31:50.000Z"), 60), 1_690_000);
  assert.throws(() => millisecondsUntilNextInterval(new Date(), 0), /positive integer/);
});

test("automation cycle runs ingestion, classification, and publication in order", async () => {
  const calls: string[] = [];
  const logs: StructuredLogEntry[] = [];
  const result = await runAutomationCycle({
    acquire: async () => { calls.push("acquire"); return true; },
    release: async (_id, status) => { calls.push(`release:${status}`); },
    ingest: async () => { calls.push("ingest"); return { discovered: 3, inserted: 2, updated: 1 }; },
    classify: async () => { calls.push("classify"); return { classified: 2, failed: 0 }; },
    publish: async () => { calls.push("publish"); return { applications: 10 }; },
    logger: (entry) => logs.push(entry),
  });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(calls, ["acquire", "ingest", "classify", "publish", "release:succeeded"]);
  assert.equal(result.metrics.emails_inserted, 2);
  assert.equal(result.metrics.applications_published, 10);
  assert.ok(logs.every((entry) => !("body_text" in entry)));
});

test("busy automation skips without executing pipeline stages", async () => {
  let executed = false;
  const result = await runAutomationCycle({
    acquire: async () => false,
    release: async () => undefined,
    ingest: async () => { executed = true; return { discovered: 0, inserted: 0, updated: 0 }; },
    classify: async () => ({ classified: 0, failed: 0 }),
    publish: async () => ({ applications: 0 }),
    logger: () => undefined,
  });
  assert.equal(result.status, "skipped");
  assert.equal(executed, false);
});

test("automation failure is sanitized, persisted, and notified", async () => {
  const releases: Array<{ status: string; error: string | null }> = [];
  let notified = false;
  const result = await runAutomationCycle({
    acquire: async () => true,
    release: async (_id, status, error) => { releases.push({ status, error }); },
    ingest: async () => { throw new Error("token=top-secret Gmail unavailable"); },
    classify: async () => ({ classified: 0, failed: 0 }),
    publish: async () => ({ applications: 0 }),
    notifyFailure: async () => { notified = true; },
    logger: () => undefined,
  });
  assert.equal(result.status, "failed");
  assert.match(result.error || "", /token=\[redacted\]/);
  assert.equal(releases[0]?.status, "failed");
  assert.equal(notified, true);
  assert.equal(sanitizedOperationsError("Bearer abc123"), "Bearer [redacted]");
});

test("operations migration reuses existing tables and enforces private RPC access", async () => {
  const [migration, successMigration] = await Promise.all([
    readFile("supabase/migrations/007_operations_automation.sql", "utf8"),
    readFile("supabase/migrations/018_last_successful_automation.sql", "utf8"),
  ]);
  assert.doesNotMatch(migration, /create table/i);
  assert.match(migration, /try_acquire_pipeline_lock/);
  assert.match(migration, /not exists[\s\S]*classification_runs/);
  assert.match(migration, /grant execute[\s\S]*service_role/);
  assert.match(migration, /reply_draft_status/);
  assert.match(migration, /add column if not exists pipeline_lock_id/);
  assert.match(migration, /notify pgrst, 'reload schema'/);
  assert.doesNotMatch(successMigration, /create table/i);
  assert.match(successMigration, /add column if not exists last_automation_succeeded_at/);
  assert.match(successMigration, /when p_status = 'succeeded' then now\(\)/);
  assert.match(successMigration, /else account\.last_automation_succeeded_at/);
  assert.match(successMigration, /grant execute[\s\S]*service_role/);
});
