import assert from "node:assert/strict";
import test from "node:test";
import type { TypeSafeClient } from "@typesafe-ai/sdk";
import {
  buildCompanyCandidates,
  buildTitleCandidates,
  companyResolutionContextHash,
  isCompanyResolutionApplicationStatus,
  resolveApplicationCompanyWithJev,
  type CompanyResolutionContext,
} from "../lib/company-resolution.js";

const context: CompanyResolutionContext = {
  applicationId: "30000000-0000-4000-8000-000000000001",
  gmailAccountId: "20000000-0000-4000-8000-000000000001",
  currentCompany: "Drew Darling",
  currentRole: "Junior AI Developer",
  requisitionId: "VZGTJP00060954",
  messages: [{
    id: "10000000-0000-4000-8000-000000000001",
    internal_date: "2026-09-10T10:49:00.000Z",
    direction: "incoming",
    from_name: "Drew Darling",
    from_email: "drew.darling@insightglobal.com",
    to_recipients: [{ email: "tirth@example.com" }],
    subject: "Verizon - Junior AI Developer",
    snippet: "A role with Verizon.",
    body_text: "Here is a Junior AI developer role with Verizon.\n\nDrew Darling\nInsight Global Inc.",
  }],
};

test("company resolution includes job states and explicitly excludes Other", () => {
  for (const status of ["applied", "outreach", "reply_needed", "information_needed", "interview_assessment", "offer", "rejected", "ghosted", "uncertain"]) {
    assert.equal(isCompanyResolutionApplicationStatus(status), true);
  }
  assert.equal(isCompanyResolutionApplicationStatus("other"), false);
});

test("company candidate discovery keeps competing employer and agency evidence", () => {
  const candidates = buildCompanyCandidates(context);
  const names = candidates.map((candidate) => candidate.name);
  assert.ok(names.includes("Drew Darling"));
  assert.ok(names.includes("Insightglobal"));
  assert.ok(names.some((name) => /Insight Global/i.test(name)));
  assert.ok(names.some((name) => /Verizon/i.test(name)));
  assert.ok(candidates.every((candidate, index) => candidate.id === `candidate_${index + 1}`));
});

test("title candidate discovery keeps the current role and message evidence", () => {
  const candidates = buildTitleCandidates(context);
  assert.ok(candidates.some((candidate) => candidate.name === "Junior AI Developer"));
  assert.ok(candidates.every((candidate, index) => candidate.id === `title_candidate_${index + 1}`));
});

test("company context hashes are deterministic and evidence-sensitive", () => {
  const candidates = buildCompanyCandidates(context);
  const first = companyResolutionContextHash(context, candidates);
  const repeated = companyResolutionContextHash(context, buildCompanyCandidates(context));
  const changedContext = {
    ...context,
    messages: [{ ...context.messages[0]!, body_text: `${context.messages[0]!.body_text}\nNew evidence` }],
  };
  assert.equal(first, repeated);
  assert.notEqual(first, companyResolutionContextHash(changedContext, buildCompanyCandidates(changedContext)));
});

test("outgoing recipients contribute employer candidates and context identity", () => {
  const outgoing = {
    ...context,
    messages: [{
      ...context.messages[0]!,
      direction: "outgoing",
      from_name: "Tirth Shah",
      from_email: "tirth@gmail.com",
      to_recipients: [{ name: "Hiring Team", email: "talent@verizon.com" }],
      subject: "Re: Verizon - Junior AI Developer",
      body_text: "Thank you for the update.",
    }],
  };
  const candidates = buildCompanyCandidates(outgoing);
  assert.ok(candidates.some((candidate) => candidate.name === "Verizon" && candidate.sources.includes("recipient_domain")));
  const firstHash = companyResolutionContextHash(outgoing, candidates);
  const changed = { ...outgoing, messages: [{ ...outgoing.messages[0]!, to_recipients: [{ email: "talent@example.org" }] }] };
  assert.notEqual(firstHash, companyResolutionContextHash(changed, buildCompanyCandidates(changed)));
});

test("Jev company resolution preserves distributions and flags weak employer choices", async () => {
  const candidates = buildCompanyCandidates(context);
  const employer = candidates.find((candidate) => /Verizon/i.test(candidate.name));
  const agency = candidates.find((candidate) => /Insight Global/i.test(candidate.name));
  const title = buildTitleCandidates(context).find((candidate) => /Junior AI Developer/i.test(candidate.name));
  assert.ok(employer);
  assert.ok(agency);
  assert.ok(title);
  let questionCount = 0;
  const client = {
    systemOne: async (request: { questions: Record<string, unknown> }) => {
      questionCount = Object.keys(request.questions).length;
      return {
        model: "jev-test",
        answers: {
          employer: { choice: employer.id, confidence: 0.72, probabilities: { [employer.id]: 0.79, none: 0.21 } },
          title: { choice: title.id, confidence: 0.96, probabilities: { [title.id]: 0.98, none: 0.02 } },
          agency: { choice: agency.id, confidence: 0.95, probabilities: { [agency.id]: 0.97, none: 0.03 } },
          platform: { choice: "none", confidence: 1, probabilities: { none: 1 } },
        },
        usage: { input_tokens: 420, output_tokens: 20 },
      };
    },
  } as unknown as TypeSafeClient;
  const result = await resolveApplicationCompanyWithJev(client, context, {
    model: "jev-test",
    minimumEmployerProbability: 0.8,
    minimumEmployerConfidence: 0.65,
  });
  assert.equal(questionCount, 4);
  assert.equal(result.employer.name, employer.name);
  assert.equal(result.agency.name, agency.name);
  assert.equal(result.title.name, title.name);
  assert.equal(result.titleNeedsLlmReview, false);
  assert.equal(result.companyNeedsLlmReview, true);
  assert.equal(result.employer.topProbability, 0.79);
  assert.equal(result.needsLlmReview, true);
  assert.equal(result.inputTokens, 420);
});
