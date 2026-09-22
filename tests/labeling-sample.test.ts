import assert from "node:assert/strict";
import test from "node:test";
import {
  isAtcEmail,
  selectAdditionalSample,
  selectLabelingSample,
  type LabelingEmail,
} from "../lib/labeling-sample.js";

function email(index: number, subject = `Message ${index}`): LabelingEmail {
  return {
    id: `id-${index}`,
    gmail_message_id: `gmail-${index}`,
    gmail_thread_id: `thread-${index}`,
    internal_date: "2026-01-01T00:00:00.000Z",
    direction: "incoming",
    from_name: "Recruiting",
    from_email: "jobs@example.com",
    to_recipients: [{ name: "Tirth Shah", email: "tirth@example.com", raw: "Tirth Shah <tirth@example.com>" }],
    subject,
    snippet: "Example",
    body_text: "Example body",
    label_ids: ["INBOX"],
  };
}

test("detects ATC as a distinct term without matching ordinary words", () => {
  assert.equal(isAtcEmail(email(1, "Your offer from ATC")), true);
  assert.equal(isAtcEmail(email(2, "Application batch completed")), false);
  const outgoing = email(3, "Interview questions - response");
  outgoing.direction = "outgoing";
  outgoing.to_recipients = [{ name: "ATC recruiter", email: "divya@atc.xyz", raw: "divya@atc.xyz" }];
  assert.equal(isAtcEmail(outgoing), true);
});

test("additional samples exclude every email already in the review pool", () => {
  const emails = Array.from({ length: 200 }, (_, index) =>
    email(index, index % 10 === 0 ? `Action required ${index}` : `Message ${index}`),
  );
  const excluded = new Set(emails.slice(0, 75).map((item) => item.id));
  const selected = selectAdditionalSample(emails, excluded, 50, "add-more", "balanced");

  assert.equal(selected.length, 50);
  assert.equal(new Set(selected.map((item) => item.id)).size, 50);
  assert.equal(selected.some((item) => excluded.has(item.id)), false);
});

test("balanced discovery surfaces more action-oriented emails than its base rate", () => {
  const emails = Array.from({ length: 200 }, (_, index) =>
    email(index, index < 40 ? `Reply needed ${index}` : `Application received ${index}`),
  );
  const selected = selectAdditionalSample(emails, new Set(), 40, "balanced", "balanced");
  const actionCount = selected.filter((item) => item.subject.startsWith("Reply needed")).length;

  assert.equal(actionCount, 28);
});

test("includes every ATC email and fills the remaining sample reproducibly", () => {
  const emails = Array.from({ length: 200 }, (_, index) => email(index));
  emails[12] = email(12, "ATC application received");
  emails[88] = email(88, "Offer from ATC");

  const first = selectLabelingSample(emails, 30, "ui-sample");
  const second = selectLabelingSample(emails, 30, "ui-sample");

  assert.equal(first.length, 30);
  assert.deepEqual(first, second);
  assert.equal(new Set(first.map((item) => item.id)).size, 30);
  assert.deepEqual(
    first
      .filter((item) => item.selection_reason === "atc_required")
      .map((item) => item.id)
      .sort(),
    ["id-12", "id-88"],
  );
});
