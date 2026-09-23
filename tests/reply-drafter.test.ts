import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReplyPrompt,
  generateReplyWithOpenAI,
  isReplyDraftEligible,
  type ReplyContext,
} from "../lib/reply-drafter.js";

const email: ReplyContext = {
  direction: "incoming",
  from_name: "Recruiter",
  from_email: "recruiter@example.com",
  to_recipients: [],
  subject: "Availability",
  snippet: "Can you meet next week?",
  body_text: "Please share your availability for next week.",
  internal_date: "2026-09-22T00:00:00Z",
  effectiveCategory: "reply_needed",
  nextAction: "write_reply",
  humanNotes: "Prefer Tuesday afternoon.",
};

test("reply prompt includes email, correction, and personal instructions", () => {
  const prompt = JSON.parse(buildReplyPrompt(email, "Be brief."));
  assert.equal(prompt.user_writing_profile, "Be brief.");
  assert.equal(prompt.classification_context.effective_category, "reply_needed");
  assert.equal(prompt.email.body, email.body_text);
});

test("reply drafts are restricted to the effective Reply Needed category", () => {
  assert.equal(isReplyDraftEligible("reply_needed"), true);
  assert.equal(isReplyDraftEligible("interview_assessment"), false);
  assert.equal(isReplyDraftEligible("other"), false);
  assert.equal(isReplyDraftEligible(null), false);
});

test("OpenAI reply generation disables storage and parses structured output", async () => {
  let requestBody: { store?: unknown } = {};
  const fetcher = async (_url: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ output_text: JSON.stringify({ subject: "Re: Availability", body: "Hi,\n\nTuesday afternoon works for me.\n\nBest,\nTirth" }) }), { status: 200 });
  };
  const draft = await generateReplyWithOpenAI("test-key", "test-model", email, "Be brief.", fetcher);
  assert.equal(requestBody.store, false);
  assert.equal(draft.subject, "Re: Availability");
  assert.match(draft.body, /Tuesday afternoon/);
});
