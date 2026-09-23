import assert from "node:assert/strict";
import test from "node:test";
import type { TypeSafeClient } from "@typesafe-ai/sdk";
import {
  evaluateApplicationRelationships,
  planAmbiguousThreadPairs,
} from "../lib/application-relationship.js";
import type { ApplicationEmailEvidence } from "../lib/application-grouping.js";

function row(id: string, company: string, date: string): ApplicationEmailEvidence {
  return {
    email_id: id,
    gmail_account_id: "account-1",
    gmail_thread_id: "reused-platform-thread",
    internal_date: date,
    direction: "incoming",
    from_name: "Shared Job Board",
    from_email: "notifications@jobboard.example",
    subject: `Thank you for applying to ${company}`,
    snippet: `Your application to ${company} was received.`,
    effective_category: "applied",
    human_category: null,
  };
}

test("ambiguous same-thread relationships are batched into one Jev request", async () => {
  const rows = [
    row("email-a", "Solaris", "2026-08-01T12:00:00Z"),
    row("email-b", "Acme", "2026-08-02T12:00:00Z"),
    row("email-c", "Northstar", "2026-08-03T12:00:00Z"),
  ];
  let requestCount = 0;
  const client = {
    systemOne: async (request: { state: unknown; questions: Record<string, unknown> }) => {
      requestCount += 1;
      assert.equal(Object.keys(request.questions).length, 3);
      assert.equal((request.state as { messages: unknown[] }).messages.length, 3);
      return {
        model: "jev-test",
        answers: {
          same_application_0: { type: "noul", noul: 0.91 },
          same_application_1: { type: "noul", noul: 0.18 },
          same_application_2: { type: "noul", noul: 0.49 },
        },
        usage: { input_tokens: 321, output_tokens: 3 },
      };
    },
  } as unknown as TypeSafeClient;

  const result = await evaluateApplicationRelationships(client, rows, {
    model: "jev-test",
    sameThreshold: 0.72,
  });
  assert.equal(requestCount, 1);
  assert.equal(result.checkedCount, 3);
  assert.equal(result.matchedCount, 1);
  assert.equal(result.failedCount, 0);
  assert.equal(result.inputTokens, 321);
  assert.equal([...result.decisions.values()].filter((decision) => decision.sameApplication).length, 1);
});

test("pair planning caps pathological reused threads", () => {
  const rows = Array.from({ length: 12 }, (_, index) => row(
    `email-${index}`,
    `Company ${index}`,
    `2026-08-${String(index + 1).padStart(2, "0")}T12:00:00Z`,
  ));
  const plans = planAmbiguousThreadPairs(rows, 7);
  assert.equal([...plans.values()][0]?.length, 7);
});
