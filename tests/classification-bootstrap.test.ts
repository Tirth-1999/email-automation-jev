import assert from "node:assert/strict";
import test from "node:test";
import {
  humanDatasetVersion,
  humanLabelImportRows,
} from "../lib/classification-bootstrap.js";
import type { LabeledEmail } from "../lib/labeling-store.js";

function labeledEmail(overrides: Partial<LabeledEmail> = {}): LabeledEmail {
  return {
    email_id: "email-1",
    gmail_message_id: "gmail-1",
    gmail_thread_id: "thread-1",
    direction: "incoming",
    from_name: "Recruiting",
    from_email: "jobs@example.com",
    to_recipients: [],
    subject: "Application received",
    snippet: "Thanks for applying",
    body_text: "Thanks for applying",
    internal_date: "2026-01-01T00:00:00.000Z",
    gmail_label_ids: ["INBOX"],
    sample_index: 1,
    batch_id: "batch-1",
    selection_reason: "random",
    manual_label: "applied",
    review_notes: "",
    labeled_at: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

test("human label imports have stable idempotency keys", () => {
  const rows = humanLabelImportRows([labeledEmail()]);
  assert.deepEqual(rows[0], {
    email_id: "email-1",
    source_key: "initial-json:email-1:2026-01-02T00:00:00.000Z",
    category: "applied",
    source: "review_ui",
    notes: "",
  });
});

test("dataset version is deterministic and order independent", () => {
  const first = labeledEmail();
  const second = labeledEmail({ email_id: "email-2", manual_label: "rejected" });
  assert.equal(humanDatasetVersion([first, second]), humanDatasetVersion([second, first]));
  assert.notEqual(
    humanDatasetVersion([first, second]),
    humanDatasetVersion([first, { ...second, manual_label: "offer" }]),
  );
});
