import assert from "node:assert/strict";
import test from "node:test";
import { buildGmailDeepLink } from "../lib/gmail-deep-link.js";

test("uses the RFC Message-ID to target one exact email", () => {
  assert.equal(
    buildGmailDeepLink({
      gmail_message_id: "gmail-message",
      gmail_thread_id: "gmail-thread",
      rfc_message_id: "<message-123@example.com>",
    }),
    "https://mail.google.com/mail/u/0/#search/in%3Aanywhere%20rfc822msgid%3Amessage-123%40example.com",
  );
});

test("falls back to the Gmail thread instead of treating a message ID as a thread", () => {
  assert.equal(
    buildGmailDeepLink({ gmail_message_id: "gmail-message", gmail_thread_id: "gmail-thread" }),
    "https://mail.google.com/mail/u/0/#all/gmail-thread",
  );
});

test("uses the message ID only when no stronger identity exists", () => {
  assert.equal(
    buildGmailDeepLink({ gmail_message_id: "gmail-message" }),
    "https://mail.google.com/mail/u/0/#all/gmail-message",
  );
});
