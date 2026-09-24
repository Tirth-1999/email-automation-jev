import assert from "node:assert/strict";
import test from "node:test";
import type { TypeSafeClient } from "@typesafe-ai/sdk";
import { routeAiChatMessage } from "../lib/ai-chat-router.js";

test("AI Chat router uses Jev SQL probability as a conservative tool-call fallback", async () => {
  const client = {
    systemOne: async () => ({
      model: "jev-test",
      answers: { route: { choice: "conversation", confidence: 0.2, probabilities: { sql: 0.42, conversation: 0.44, unsupported: 0.14 } } },
      usage: { input_tokens: 120, output_tokens: 12 },
    }),
  } as unknown as TypeSafeClient;
  const decision = await routeAiChatMessage(client, "What about last month?", [], "jev-test");
  assert.equal(decision.route, "sql");
  assert.equal(decision.probabilities.sql, 0.42);
});

test("AI Chat router keeps confident conversational messages out of SQL", async () => {
  const client = {
    systemOne: async () => ({
      model: "jev-test",
      answers: { route: { choice: "conversation", confidence: 0.94, probabilities: { sql: 0.01, conversation: 0.98, unsupported: 0.01 } } },
      usage: { input_tokens: 80, output_tokens: 12 },
    }),
  } as unknown as TypeSafeClient;
  const decision = await routeAiChatMessage(client, "Thanks!", [], "jev-test");
  assert.equal(decision.route, "conversation");
});
