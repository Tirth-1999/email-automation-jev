import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  reviewEmailWithOpenAI,
  summarizeLlmEvaluation,
  type LlmReviewInput,
} from "../lib/llm-reviewer.js";

interface LabeledEmail {
  email_id: string;
  manual_label: string;
  direction: "incoming" | "outgoing" | "unknown";
  from_name: string | null;
  from_email: string | null;
  to_recipients?: LlmReviewInput["to_recipients"];
  subject: string;
  snippet: string;
  body_text: string;
  internal_date?: string;
}

function argument(name: string, fallback: number): number {
  const raw = process.argv.find((value) => value.startsWith(`--${name}=`))?.split("=")[1];
  return raw ? Number(raw) : fallback;
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("Set OPENAI_API_KEY before running the LLM evaluation");
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const limit = Math.max(1, Math.min(200, argument("limit", 20)));
  const labeledPath = resolve("data/labeling/generated/labeled-emails.json");
  const outputPath = resolve("data/labeling/generated/llm-review-evaluation.json");
  const store = JSON.parse(await readFile(labeledPath, "utf8")) as { emails: LabeledEmail[] };
  const target = new Set(["reply_needed", "information_needed", "interview_assessment", "offer"]);
  const emails = store.emails.filter((email) => target.has(email.manual_label)).slice(0, limit);
  const results = [] as Array<Record<string, unknown>>;
  for (const email of emails) {
    const decision = await reviewEmailWithOpenAI(apiKey, model, {
      emailId: email.email_id,
      direction: email.direction,
      from_name: email.from_name,
      from_email: email.from_email,
      to_recipients: email.to_recipients || [],
      subject: email.subject,
      snippet: email.snippet,
      body_text: email.body_text,
      internal_date: email.internal_date || "",
      jevCategory: null,
      jevConfidence: null,
      nextAction: null,
      candidateApplications: [],
    });
    results.push({ email_id: email.email_id, subject: email.subject, expected: email.manual_label, predicted: decision.category, confidence: decision.confidence, decision });
    console.log(`${results.length}/${emails.length} ${email.manual_label} -> ${decision.category} (${decision.confidence.toFixed(2)})`);
  }
  const summary = summarizeLlmEvaluation(results.map((result) => ({
    expected: String(result.expected),
    predicted: String(result.predicted),
    confidence: Number(result.confidence),
  })));
  await writeFile(outputPath, `${JSON.stringify({ generated_at: new Date().toISOString(), model, dataset: "human-labeled-high-value", summary, results }, null, 2)}\n`, "utf8");
  console.log(`Saved ${outputPath}`);
  console.log(summary);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
