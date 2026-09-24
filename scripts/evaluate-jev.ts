import "dotenv/config";
import { resolve } from "node:path";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import {
  classifyEmailWithJev,
  CLASSIFIER_VERSION,
  JEV_CATEGORIES,
  type JevCategory,
} from "../lib/jev-classifier.js";
import {
  readJson,
  writePrivateJson,
  type LabeledEmail,
} from "../lib/labeling-store.js";

interface EvaluationSet {
  emails: LabeledEmail[];
}

interface TypeSafeApiError {
  status?: number;
  body?: { detail?: { message?: string } };
}

function numericEnvironment(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`);
  return value;
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      const value = values[index];
      if (value === undefined) return;
      results[index] = await mapper(value, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

if (!process.env.TYPESAFE_API_KEY?.trim() || process.env.TYPESAFE_API_KEY === "replace_me") {
  throw new Error("Set TYPESAFE_API_KEY in .env before running the Jev evaluation");
}

function billingErrorMessage(error: unknown): string | null {
  const apiError = error as TypeSafeApiError;
  if (apiError?.status !== 402) return null;
  return apiError.body?.detail?.message
    || "Your TypeSafe organization has no available API credits.";
}

async function main(): Promise<void> {
const model = process.env.TYPESAFE_MODEL?.trim() || "jev-1.13.0";
const minimumTopProbability = numericEnvironment("JEV_MIN_TOP_PROBABILITY", 0.6);
const concurrency = Math.floor(numericEnvironment("JEV_EVAL_CONCURRENCY", 5));
const allLabeled = process.argv.includes("--all-labeled");
const input = await readJson<EvaluationSet>(
  resolve(
    process.cwd(),
    allLabeled
      ? "data/labeling/generated/labeled-emails.json"
      : "data/labeling/generated/jev-evaluation.json",
  ),
);
const evaluationEmails = input.emails.filter((email) =>
  JEV_CATEGORIES.includes(email.manual_label as JevCategory),
);
const client = new TypeSafeClient({ defaultModel: model, timeout: 30_000 });

const results = await mapConcurrent(evaluationEmails, concurrency, async (email, index) => {
  const prediction = await classifyEmailWithJev(client, email, {
    model,
    minimumTopProbability,
  });
  console.log(`${index + 1}/${evaluationEmails.length} ${email.manual_label} -> ${prediction.decision}`);
  return {
    email_id: email.email_id,
    subject: email.subject,
    sender: email.from_email,
    direction: email.direction,
    expected: email.manual_label as JevCategory,
    ...prediction,
  };
});

const automatic = results.filter((row) => row.decision !== "uncertain");
const correct = results.filter((row) => row.category === row.expected);
const correctAutomatic = automatic.filter((row) => row.decision === row.expected);
const perCategory = Object.fromEntries(
  JEV_CATEGORIES.map((category) => {
    const rows = results.filter((row) => row.expected === category);
    return [
      category,
      {
        count: rows.length,
        correct: rows.filter((row) => row.category === category).length,
        uncertain: rows.filter((row) => row.decision === "uncertain").length,
        accuracy: rows.length
          ? rows.filter((row) => row.category === category).length / rows.length
          : null,
      },
    ];
  }),
);
const confusionMatrix = Object.fromEntries(
  JEV_CATEGORIES.map((expected) => [
    expected,
    Object.fromEntries(
      [...JEV_CATEGORIES, "uncertain"].map((predicted) => [
        predicted,
        results.filter(
          (row) => row.expected === expected && row.decision === predicted,
        ).length,
      ]),
    ),
  ]),
);
const report = {
  version: 2,
  classifier_version: CLASSIFIER_VERSION,
  evaluation_scope: allLabeled
    ? "all 199 classifiable human labels; diagnostic because development examples are included"
    : "39-email untouched held-out set",
  benchmark_scope: {
    email_category: "scored against human labels",
    action: "unscored until human action labels are collected",
    urgency: "unscored until human urgency labels are collected",
    draft_reply: "unscored until human draft/no-draft labels are collected",
  },
  generated_at: new Date().toISOString(),
  model_requested: model,
  model_returned: [...new Set(results.map((row) => row.model))],
  minimum_top_probability: minimumTopProbability,
  metrics: {
    examples: results.length,
    raw_accuracy: results.length ? correct.length / results.length : 0,
    automatic_coverage: results.length ? automatic.length / results.length : 0,
    automatic_accuracy: automatic.length ? correctAutomatic.length / automatic.length : 0,
    total_input_tokens: results.reduce((sum, row) => sum + row.input_tokens, 0),
  },
  per_category: perCategory,
  confusion_matrix: confusionMatrix,
  results,
};
await writePrivateJson(
  resolve(
    process.cwd(),
    allLabeled
      ? "data/labeling/generated/jev-all-labeled-results.json"
      : "data/labeling/generated/jev-evaluation-results.json",
  ),
  report,
);
console.log(JSON.stringify(report.metrics, null, 2));
}

main().catch((error: unknown) => {
  const billingMessage = billingErrorMessage(error);
  console.error(
    billingMessage
      ? `Jev evaluation stopped: ${billingMessage}\nAdd credits at https://console.typesafe.ai/settings/billing, then rerun the same command.`
      : `Jev evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
