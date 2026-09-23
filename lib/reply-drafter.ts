import type { ClassifiableEmail } from "./jev-classifier.js";

export interface ReplyContext extends ClassifiableEmail {
  effectiveCategory: string | null;
  nextAction: string | null;
  humanNotes: string;
}

export interface ReplyDraft {
  subject: string;
  body: string;
  provider: "openai";
  model: string;
}

export const DEFAULT_REPLY_PROFILE = [
  "Write as Tirth Shah in a concise, warm, professional tone.",
  "Do not invent qualifications, dates, availability, work authorization, compensation, attachments, or commitments.",
  "Use only facts present in the email or the user's additional instructions.",
  "If an essential fact is missing, insert a short [confirm ...] placeholder instead of guessing.",
].join(" ");

function responseText(payload: { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }): string | null {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return null;
}

export function isReplyDraftEligible(category: string | null | undefined): boolean {
  return category === "reply_needed";
}

export function buildReplyPrompt(
  email: ReplyContext,
  personalInstructions: string,
): string {
  return JSON.stringify({
    task: "Draft a reply to this job-search email for the user to review. Do not send it.",
    user_writing_profile: personalInstructions.trim() || DEFAULT_REPLY_PROFILE,
    classification_context: {
      effective_category: email.effectiveCategory,
      next_action: email.nextAction,
      human_notes: email.humanNotes,
    },
    email: {
      direction: email.direction,
      from_name: email.from_name,
      from_email: email.from_email,
      to_recipients: email.to_recipients || [],
      subject: email.subject,
      snippet: email.snippet,
      body: email.body_text.slice(0, 30_000),
      date: email.internal_date || null,
    },
  });
}

export async function generateReplyWithOpenAI(
  apiKey: string,
  model: string,
  email: ReplyContext,
  personalInstructions: string,
  fetcher: typeof fetch = fetch,
): Promise<ReplyDraft> {
  const response = await fetcher("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      instructions: "You draft factual job-search email replies. Return only the requested structured result. Never claim the email was sent.",
      input: buildReplyPrompt(email, personalInstructions),
      max_output_tokens: 700,
      text: {
        format: {
          type: "json_schema",
          name: "email_reply_draft",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              subject: { type: "string" },
              body: { type: "string" },
            },
            required: ["subject", "body"],
          },
        },
      },
    }),
  });
  const payload = await response.json() as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenAI request failed with status ${response.status}`);
  }
  const output = responseText(payload);
  if (!output) throw new Error("OpenAI returned no reply draft");
  const parsed = JSON.parse(output) as { subject?: unknown; body?: unknown };
  if (typeof parsed.subject !== "string" || typeof parsed.body !== "string") {
    throw new Error("OpenAI returned an invalid reply draft");
  }
  return {
    subject: parsed.subject.trim(),
    body: parsed.body.trim(),
    provider: "openai",
    model,
  };
}

export async function streamReplyWithOpenAI(
  apiKey: string,
  model: string,
  email: ReplyContext,
  personalInstructions: string,
  onDelta: (delta: string) => void,
  fetcher: typeof fetch = fetch,
): Promise<ReplyDraft> {
  const subject = /^re:/i.test(email.subject) ? email.subject : `Re: ${email.subject || "Your email"}`;
  const response = await fetcher("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      stream: true,
      instructions: [
        "Draft only the body of a factual job-search email reply.",
        "Do not include a subject line, markdown fence, explanation, or claim that the message was sent.",
        "Do not invent facts. Use a short [confirm ...] placeholder for essential missing information.",
      ].join(" "),
      input: buildReplyPrompt(email, personalInstructions),
      max_output_tokens: 700,
    }),
  });
  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(payload.error?.message || `OpenAI stream failed with status ${response.status}`);
  }
  const decoder = new TextDecoder();
  let buffer = "";
  let body = "";
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const event of events) {
      for (const line of event.split("\n")) {
        if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
        const payload = JSON.parse(line.slice(6)) as { type?: string; delta?: string; error?: { message?: string } };
        if (payload.type === "response.output_text.delta" && payload.delta) {
          body += payload.delta;
          onDelta(payload.delta);
        } else if (payload.type === "error") {
          throw new Error(payload.error?.message || "OpenAI stream failed");
        }
      }
    }
  }
  if (!body.trim()) throw new Error("OpenAI returned an empty reply draft");
  return { subject, body: body.trim(), provider: "openai", model };
}
