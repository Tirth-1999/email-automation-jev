import assert from "node:assert/strict";
import test from "node:test";
import { buildLlmReviewPayload, reviewEmailWithOpenAI, shouldRequestLlmReview, summarizeLlmEvaluation } from "../lib/llm-reviewer.js";

const input = {
  emailId: "email-1",
  direction: "incoming" as const,
  from_name: "Recruiter",
  from_email: "recruiter@example.com",
  to_recipients: [],
  subject: "Interview availability",
  snippet: "Please share times",
  body_text: "Please reply with your availability for an interview.",
  internal_date: "2026-09-23T00:00:00Z",
  jevCategory: "reply_needed",
  jevConfidence: 0.81,
  nextAction: "write_reply",
  candidateApplications: [],
};

test("targets high-value and uncertain decisions", () => {
  assert.equal(shouldRequestLlmReview("offer", 0.99), true);
  assert.equal(shouldRequestLlmReview("applied", 0.6), true);
  assert.equal(shouldRequestLlmReview("applied", 0.95), false);
});

test("summarizes labeled LLM eval results", () => {
  const summary = summarizeLlmEvaluation([
    { expected: "offer", predicted: "offer", confidence: 0.9 },
    { expected: "reply_needed", predicted: "interview_assessment", confidence: 0.8 },
  ]);
  assert.equal(summary.accuracy, 0.5);
  assert.equal(summary.confusion["reply_needed -> interview_assessment"], 1);
});

test("builds bounded structured evidence", () => {
  const payload = buildLlmReviewPayload(input);
  assert.equal((payload.email as { id: string }).id, "email-1");
  assert.equal((payload.jev as { category: string }).category, "reply_needed");
});

test("parses a schema-conforming review", async () => {
  const fetcher = async () => new Response(JSON.stringify({
    output_text: JSON.stringify({
      category: "reply_needed",
      confidence: 0.96,
      should_override_jev: false,
      reason: "A written answer is requested.",
      evidence: ["Please reply"],
      related_application_id: null,
      relationship_confidence: 0,
      relationship_reason: "No candidate application supplied.",
    }),
  }), { status: 200, headers: { "Content-Type": "application/json" } });
  const result = await reviewEmailWithOpenAI("key", "gpt-4o-mini", input, fetcher as typeof fetch);
  assert.equal(result.category, "reply_needed");
  assert.equal(result.confidence, 0.96);
});

test("parses the raw Responses API output envelope", async () => {
  const decision = {
    category: "interview_assessment",
    confidence: 0.91,
    should_override_jev: true,
    reason: "The requested action is an assessment link, not a written reply.",
    evidence: ["complete the assessment"],
    related_application_id: null,
    relationship_confidence: 0,
    relationship_reason: "No relationship candidate matched.",
  };
  const fetcher = async () => new Response(JSON.stringify({
    output: [{ content: [{ type: "output_text", text: JSON.stringify(decision) }] }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
  const result = await reviewEmailWithOpenAI("key", "gpt-4o-mini", input, fetcher as typeof fetch);
  assert.equal(result.category, "interview_assessment");
});
