import assert from "node:assert/strict";
import test from "node:test";
import type { gmail_v1 } from "googleapis";
import {
  decodeBase64Url,
  normalizeGmailMessage,
  parseAddressList,
} from "../lib/parse-email.js";

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

test("decodes Gmail base64url content", () => {
  assert.equal(decodeBase64Url(encode("Hello + résumé")), "Hello + résumé");
});
test("parses named and plain address lists", () => {
  assert.deepEqual(
    parseAddressList('Recruiter Person <Recruiter@Example.com>, jobs@example.org'),
    [
      {
        name: "Recruiter Person",
        email: "recruiter@example.com",
        raw: "Recruiter Person <Recruiter@Example.com>",
      },
      {
        name: null,
        email: "jobs@example.org",
        raw: "jobs@example.org",
      },
    ],
  );
});

test("normalizes multipart messages and records attachment metadata", () => {
  const message: gmail_v1.Schema$Message = {
    id: "gmail-message-1",
    threadId: "gmail-thread-1",
    historyId: "1234",
    internalDate: "1760000000000",
    labelIds: ["INBOX", "UNREAD"],
    snippet: "Thanks for applying",
    sizeEstimate: 321,
    payload: {
      mimeType: "multipart/mixed",
      headers: [
        { name: "From", value: "Acme Recruiting <jobs@acme.com>" },
        { name: "To", value: "Candidate <candidate@gmail.com>" },
        { name: "Subject", value: "Application received" },
        { name: "Message-ID", value: "<source-id@acme.com>" },
      ],
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [
            { mimeType: "text/plain", body: { data: encode("Thanks for applying.") } },
            { mimeType: "text/html", body: { data: encode("<p>Thanks for applying.</p>") } },
          ],
        },
        {
          mimeType: "application/pdf",
          filename: "role.pdf",
          body: { attachmentId: "attachment-1", size: 42 },
        },
      ],
    },
  };

  const normalized = normalizeGmailMessage(message, "candidate@gmail.com");
  assert.equal(normalized.gmail_message_id, "gmail-message-1");
  assert.equal(normalized.from_email, "jobs@acme.com");
  assert.equal(normalized.direction, "incoming");
  assert.equal(normalized.body_text, "Thanks for applying.");
  assert.equal(normalized.body_html, "<p>Thanks for applying.</p>");
  assert.deepEqual(normalized.attachment_metadata, [
    {
      filename: "role.pdf",
      mimeType: "application/pdf",
      attachmentId: "attachment-1",
      size: 42,
    },
  ]);
});

test("derives plain text when a message only has HTML", () => {
  const message: gmail_v1.Schema$Message = {
    id: "gmail-message-2",
    threadId: "gmail-thread-2",
    internalDate: "1760000000000",
    payload: {
      mimeType: "text/html",
      headers: [{ name: "From", value: "jobs@example.com" }],
      body: { data: encode("<p>Schedule your <strong>interview</strong>.</p>") },
    },
  };

  const normalized = normalizeGmailMessage(message, "candidate@gmail.com");
  assert.equal(normalized.body_text, "Schedule your interview.");
});
