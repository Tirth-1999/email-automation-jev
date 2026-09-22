import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { sanitizedClassificationError } from "../lib/classification-repository.js";

test("redacts common credentials from persisted classification errors", () => {
  const message = sanitizedClassificationError(
    new Error("Bearer private-token api_key=secret-value password:also-secret"),
  );
  assert.equal(
    message,
    "Bearer [redacted] api_key=[redacted] password=[redacted]",
  );
});

test("classification migration defines the durable Phase 5 boundary", async () => {
  const migration = await readFile(
    resolve(process.cwd(), "supabase/migrations/002_classification_pipeline.sql"),
    "utf8",
  );
  const requiredRelations = [
    "classifier_versions",
    "classification_runs",
    "email_classification_results",
    "email_human_label_events",
    "classification_review_cases",
    "latest_email_classifications",
    "latest_email_human_labels",
    "classification_run_summary",
    "email_board_items",
  ];
  for (const relation of requiredRelations) {
    assert.match(migration, new RegExp(`(?:table|view) public\\.${relation}\\b`));
  }
  assert.match(migration, /unique \(run_id, email_id\)/);
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /revoke all on public\.classification_runs from anon, authenticated/);
  assert.match(migration, /grant execute on function public\.refresh_classification_run_counters/);
});

test("email board view avoids exposing full email bodies", async () => {
  const migration = await readFile(
    resolve(process.cwd(), "supabase/migrations/002_classification_pipeline.sql"),
    "utf8",
  );
  const boardView = migration.split("create view public.email_board_items")[1]?.split("alter table")[0];
  assert.ok(boardView);
  assert.doesNotMatch(boardView, /body_text|body_html|raw_headers/);
});

test("bootstrap migration enforces idempotent append-only labels", async () => {
  const migration = await readFile(
    resolve(process.cwd(), "supabase/migrations/003_classification_bootstrap_keys.sql"),
    "utf8",
  );
  assert.match(migration, /unique \(source_key\)/);
  assert.match(migration, /email_human_label_events_append_only/);
  assert.match(migration, /email_classification_results_terminal_immutable/);
});
