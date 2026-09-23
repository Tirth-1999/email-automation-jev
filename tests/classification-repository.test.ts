import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  classificationBatchRows,
  sanitizedClassificationError,
} from "../lib/classification-repository.js";
import type { JevClassification } from "../lib/jev-classifier.js";

test("redacts common credentials from persisted classification errors", () => {
  const message = sanitizedClassificationError(
    new Error("Bearer private-token api_key=secret-value password:also-secret"),
  );
  assert.equal(
    message,
    "Bearer [redacted] api_key=[redacted] password=[redacted]",
  );
});

test("builds one bulk persistence payload for a completed batch", () => {
  const result: JevClassification = {
    classifier_version: "job-email-jev-v4",
    category: "applied",
    decision: "applied",
    confidence: 0.9,
    top_probability: 0.9,
    probabilities: { applied: 0.9, outreach: 0.01, reply_needed: 0.01, interview_assessment: 0.01, offer: 0.01, rejected: 0.01, other: 0.05 },
    action: { choice: "no_action", confidence: 0.9, probabilities: { no_action: 0.9, write_reply: 0.01, open_link: 0.01, fill_form: 0.01, schedule_interview: 0.01, complete_assessment: 0.01, send_document: 0.01, review_offer: 0.04 } },
    urgency: { score: 0, confidence: 0.9, probabilities: { none: 0.9, low: 0.05, normal: 0.03, high: 0.01, immediate: 0.01 } },
    draft_reply: { probability: 0.01, should_draft: false },
    model: "jev-1.13.0",
    input_tokens: 123,
  };
  const rows = classificationBatchRows(
    "run-1",
    [
      { emailId: "email-1", result },
      { emailId: "email-2", error: new Error("api_key=private") },
    ],
    "2026-09-22T00:00:00.000Z",
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.status, "succeeded");
  assert.equal(rows[1]?.status, "failed");
  assert.equal(rows[1]?.error_message, "api_key=[redacted]");
  assert.deepEqual(Object.keys(rows[0] || {}).sort(), Object.keys(rows[1] || {}).sort());
});

test("classification migration simplifies the MVP to five tables and one view", async () => {
  const migration = await readFile(
    resolve(process.cwd(), "supabase/migrations/004_simplify_mvp_schema.sql"),
    "utf8",
  );
  assert.match(migration, /rename to email_classifications/);
  assert.match(migration, /create view public\.email_board/);
  assert.match(migration, /add column classifier_version text/);
  assert.match(migration, /add column human_category text/);
  assert.match(migration, /drop table public\.classifier_versions/);
  assert.match(migration, /drop table public\.email_human_label_events/);
  assert.match(migration, /drop table public\.classification_review_cases/);
  assert.match(migration, /grant execute on function public\.refresh_classification_run_counters/);
});

test("email board view avoids exposing full email bodies", async () => {
  const migration = await readFile(
    resolve(process.cwd(), "supabase/migrations/004_simplify_mvp_schema.sql"),
    "utf8",
  );
  const boardView = migration.split("create view public.email_board")[1]?.split("revoke all")[0];
  assert.ok(boardView);
  assert.doesNotMatch(boardView, /body_text|body_html|raw_headers/);
});

test("simplification retains terminal classification immutability", async () => {
  const migration = await readFile(
    resolve(process.cwd(), "supabase/migrations/004_simplify_mvp_schema.sql"),
    "utf8",
  );
  assert.match(migration, /email_classifications_terminal_immutable/);
  assert.match(migration, /from public\.email_classifications/);
});
