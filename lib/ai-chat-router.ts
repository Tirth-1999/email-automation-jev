import { choice, type TypeSafeClient } from "@typesafe-ai/sdk";

export type AiChatRoute = "sql" | "conversation" | "unsupported";

export interface AiChatRouteDecision {
  route: AiChatRoute;
  confidence: number;
  probabilities: Record<AiChatRoute, number>;
  model: string;
  inputTokens: number;
}

export interface AiChatHistoryMessage {
  role: "user" | "assistant";
  text: string;
}

export async function routeAiChatMessage(
  client: TypeSafeClient,
  message: string,
  history: AiChatHistoryMessage[],
  model: string,
): Promise<AiChatRouteDecision> {
  const response = await client.systemOne({
    model,
    state: {
      assistant_scope: "A read-only job-search mailbox assistant backed by applications, classified emails, application statuses, dates, companies, roles, actions, and processing runs.",
      recent_conversation: history.slice(-6).map((item) => `${item.role}: ${item.text.slice(0, 600)}`),
      latest_user_message: message.slice(0, 2_000),
    },
    questions: {
      route: choice({
        task: "How should the job-search mailbox assistant handle the latest user message?",
        rules: [
          "Choose sql whenever answering requires facts, counts, lists, dates, comparisons, statuses, companies, roles, emails, or outcomes from the user's mailbox database.",
          "Use recent conversation to recognize follow-ups that still require mailbox data.",
          "Choose conversation only when no mailbox lookup is needed.",
          "Choose unsupported for unrelated knowledge or any request to modify, send, delete, merge, or relabel data.",
        ],
      }, {
        sql: {
          use_when: "The answer requires reading the user's mailbox or application database.",
          examples: ["How many applications?", "Show interviews this month", "Which companies rejected me?", "What needs a reply?"],
        },
        conversation: {
          use_when: "A greeting, thanks, clarification of assistant capabilities, or ordinary conversational response that needs no mailbox facts.",
          examples: ["Hello", "Thanks", "What can you help me with?"],
        },
        unsupported: {
          use_when: "The message is unrelated to the job-search mailbox, requests external facts, or asks the read-only chat to change data or send email.",
          examples: ["What's the weather?", "Delete all rejected applications", "Send this email"],
        },
      }),
    },
  });
  const answer = response.answers.route;
  const probabilities = answer.probabilities as Record<AiChatRoute, number>;
  // When the distribution is split but mailbox lookup remains plausible, prefer
  // the read-only tool over answering a database question from memory.
  const route = answer.choice !== "sql" && (probabilities.sql || 0) >= 0.35
    ? "sql"
    : answer.choice as AiChatRoute;
  return {
    route,
    confidence: answer.confidence,
    probabilities,
    model: response.model,
    inputTokens: response.usage.input_tokens,
  };
}
