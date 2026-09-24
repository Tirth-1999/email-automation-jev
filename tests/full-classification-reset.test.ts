import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { resetAccountClassificationState } from "../lib/classification-repository.js";

test("full reset reports deleted runs, results, and cleared overrides", async () => {
  const database = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      assert.equal(name, "reset_account_classification_state");
      assert.deepEqual(args, { p_account_id: "account-1" });
      return {
        data: {
          classification_runs_deleted: 12,
          classification_results_deleted: 6_943,
          email_overrides_cleared: 200,
          applications_reset: 8,
          manual_links_deleted: 3,
          manual_events_deleted: 8,
        },
        error: null,
      };
    },
  };
  const result = await resetAccountClassificationState(database as never, "account-1");
  assert.deepEqual(result, {
    classification_runs_deleted: 12,
    classification_results_deleted: 6_943,
    email_overrides_cleared: 200,
    applications_reset: 8,
    manual_links_deleted: 3,
    manual_events_deleted: 8,
  });
});

test("migration 015 scopes the destructive reset and protects active runs", async () => {
  const migration = await readFile(
    resolve(process.cwd(), "supabase/migrations/015_full_classification_reset.sql"),
    "utf8",
  );
  assert.match(migration, /where gmail_account_id = p_account_id/);
  assert.match(migration, /status in \('queued', 'running'\)/);
  assert.match(migration, /delete from public\.classification_runs/);
  assert.match(migration, /human_category = null/);
  assert.match(migration, /llm_review_category = null/);
  assert.doesNotMatch(migration, /application_starred_at = null/);
  assert.match(migration, /association_source = 'manual'/);
  assert.match(migration, /event\.source = 'manual'/);
  assert.match(migration, /grouping_source = 'deterministic'/);
  assert.doesNotMatch(migration, /delete from public\.emails/);
  assert.match(migration, /grant execute[\s\S]*to service_role/);
});

test("Command Center exposes guarded incremental, full-history, and fresh-replacement modes", async () => {
  const [html, browser, server] = await Promise.all([
    readFile(resolve(process.cwd(), "apps/dashboard/index.html"), "utf8"),
    readFile(resolve(process.cwd(), "apps/dashboard/src/app.js"), "utf8"),
    readFile(resolve(process.cwd(), "apps/server/index.ts"), "utf8"),
  ]);
  assert.match(html, /New emails only/);
  assert.match(html, /Entire mailbox/);
  assert.match(html, /Drop old records \+ save fresh/);
  assert.match(html, /commandClassificationConcurrency/);
  assert.match(html, /commandClassificationBatchSize/);
  assert.match(html, /cancelCommandIngestion/);
  assert.match(html, /cancelCommandClassification/);
  assert.match(html, /cancelCommandOutputs/);
  assert.match(browser, /replace_existing/);
  assert.match(browser, /cancelCommandJob/);
  assert.match(browser, /handleCommandClassificationAction/);
  assert.match(browser, /Resume.*remaining/);
  assert.match(browser, /Retry Gmail sync/);
  assert.match(browser, /classificationInterrupted/);
  assert.match(browser, /ingestionInterrupted/);
  assert.match(browser, /status\?fresh=1/);
  assert.match(browser, /window\.confirm/);
  assert.match(server, /resetExisting: scopeValue === "all"/);
  assert.match(server, /\/api\/command\/cancel-active/);
  assert.match(server, /createRecoveryClassificationRun/);
  assert.match(server, /source_run_id: sourceRunId/);
  assert.match(server, /searchParams\.get\("fresh"\) === "1"/);
  assert.match(server, /cancelManualPipeline/);
});
