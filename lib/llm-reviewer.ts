import type { ClassifiableEmail } from "./jev-classifier.js";

export const LLM_REVIEW_CATEGORIES = [
  "applied",
  "outreach",
  "reply_needed",
  "interview_assessment",
  "offer",
  "rejected",
  "other",
  "uncertain",
] as const;

export type LlmReviewCategory = (typeof LLM_REVIEW_CATEGORIES)[number];

export interface LlmReviewInput extends ClassifiableEmail {
  emailId: string;
  jevCategory: string | null;
  jevConfidence: number | null;
  nextAction: string | null;
  candidateApplications: Array<{
    id: string;
    company: string | null;
    role: string | null;
    latestSubject: string | null;
  }>;
}

export interface LlmReviewDecision {
  category: LlmReviewCategory;
  confidence: number;
  should_override_jev: boolean;
  reason: string;
  evidence: string[];
  related_application_id: string | null;
  relationship_confidence: number;
  relationship_reason: string;
}

export interface LlmEvaluationExample {
  expected: string;
  predicted: string;
  confidence: number;
}

export function summarizeLlmEvaluation(examples: LlmEvaluationExample[]) {
  const correct = examples.filter((example) => example.expected === example.predicted).length;
  const reviewed = examples.length;
  const confusion: Record<string, number> = {};
  for (const example of examples) {
    if (example.expected === example.predicted) continue;
    const key = `${example.expected} -> ${example.predicted}`;
    confusion[key] = (confusion[key] || 0) + 1;
  }
  return {
    reviewed,
    correct,
    accuracy: reviewed ? correct / reviewed : 0,
    average_confidence: reviewed ? examples.reduce((sum, example) => sum + example.confidence, 0) / reviewed : 0,
    confusion,
  };
}

function responseText(payload: { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }): string | null {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return null;
}

export const LLM_REVIEW_SYSTEM_PROMPT = [
  "You are the high-precision second-stage reviewer for a job-search email tracker.",
  "Jev is the primary classifier. Review only the supplied evidence and return the required JSON schema.",
  "reply_needed means the user must write a response; a link-only task belongs in interview_assessment or applied, not reply_needed.",
  "interview_assessment includes interview scheduling, calendar invitations, coding tests, take-homes, screening bots, and assessments.",
  "offer requires explicit evidence that employment or contract terms are being offered; enthusiasm or next steps are not an offer.",
  "outreach is a cold or proactive contact and must not become ghosted merely because nobody replied.",
  "Choose a related_application_id only when company and role/requisition evidence show the same opportunity. Shared job-board threads alone are insufficient.",
  "Never invent a company, role, requisition, relationship, or action. Use uncertain when the evidence cannot support a reliable decision.",
].join(" ");

export function shouldRequestLlmReview(category: string | null, confidence: number | null): boolean {
  return ["reply_needed", "interview_assessment", "offer"].includes(category || "")
    || (typeof confidence === "number" && confidence < 0.72);
}

export function buildLlmReviewPayload(input: LlmReviewInput): Record<string, unknown> {
  return {
    task: "Review Jev's category and decide whether this email belongs to an existing application.",
    jev: {
      category: input.jevCategory,
      confidence: input.jevConfidence,
      next_action: input.nextAction,
    },
    email: {
      id: input.emailId,
      direction: input.direction,
      from_name: input.from_name,
      from_email: input.from_email,
      to_recipients: input.to_recipients || [],
      subject: input.subject,
      snippet: input.snippet,
      body: input.body_text.slice(0, 24_000),
      date: input.internal_date || null,
    },
    candidate_applications: input.candidateApplications,
  };
}

export async function reviewEmailWithOpenAI(
  apiKey: string,
  model: string,
  input: LlmReviewInput,
  fetcher: typeof fetch = fetch,
): Promise<LlmReviewDecision> {
  const response = await fetcher("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      instructions: LLM_REVIEW_SYSTEM_PROMPT,
      input: JSON.stringify(buildLlmReviewPayload(input)),
      max_output_tokens: 900,
      text: {
        format: {
          type: "json_schema",
          name: "job_email_review",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              category: { type: "string", enum: [...LLM_REVIEW_CATEGORIES] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              should_override_jev: { type: "boolean" },
              reason: { type: "string" },
              evidence: { type: "array", items: { type: "string" }, maxItems: 5 },
              related_application_id: { anyOf: [{ type: "string" }, { type: "null" }] },
              relationship_confidence: { type: "number", minimum: 0, maximum: 1 },
              relationship_reason: { type: "string" },
            },
            required: ["category", "confidence", "should_override_jev", "reason", "evidence", "related_application_id", "relationship_confidence", "relationship_reason"],
          },
        },
      },
    }),
  });
  const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || `OpenAI review failed with status ${response.status}`);
  const output = responseText(payload);
  if (!output) throw new Error("OpenAI returned no structured review");
  const decision = JSON.parse(output) as LlmReviewDecision;
  if (!LLM_REVIEW_CATEGORIES.includes(decision.category) || typeof decision.confidence !== "number") {
    throw new Error("OpenAI returned an invalid review");
  }
  return decision;
}
