import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { JEV_CATEGORIES, type JevCategory } from "../lib/jev-classifier.js";
import {
  readJson,
  writePrivateJson,
  type LabeledEmail,
  type LabeledStore,
} from "../lib/labeling-store.js";

const sourcePath = resolve(process.cwd(), "data/labeling/generated/labeled-emails.json");
const outputDirectory = resolve(process.cwd(), "data/labeling/generated");
const seed = "jev-evaluation-v1";

function stableRank(email: LabeledEmail): string {
  return createHash("sha256").update(`${seed}:${email.email_id}`).digest("hex");
}

const store = await readJson<LabeledStore>(sourcePath);
const allowed = new Set<string>([...JEV_CATEGORIES, "uncertain"]);
const duplicateCount = store.emails.length - new Set(store.emails.map((email) => email.email_id)).size;
const invalid = store.emails.filter((email) => !allowed.has(email.manual_label));
if (duplicateCount > 0) throw new Error(`Found ${duplicateCount} duplicate email IDs`);
if (invalid.length > 0) throw new Error(`Found ${invalid.length} invalid manual labels`);

const development: LabeledEmail[] = [];
const evaluation: LabeledEmail[] = [];
const manualReview = store.emails.filter((email) => email.manual_label === "uncertain");
const distribution: Record<string, { total: number; development: number; evaluation: number }> = {};

for (const category of JEV_CATEGORIES) {
  const rows = store.emails
    .filter((email) => email.manual_label === category)
    .sort((left, right) => stableRank(left).localeCompare(stableRank(right)));
  const evaluationCount = rows.length >= 5 ? Math.max(1, Math.round(rows.length * 0.2)) : 0;
  evaluation.push(...rows.slice(0, evaluationCount));
  development.push(...rows.slice(evaluationCount));
  distribution[category] = {
    total: rows.length,
    development: rows.length - evaluationCount,
    evaluation: evaluationCount,
  };
}

const warnings = JEV_CATEGORIES.flatMap((category) => {
  const counts = distribution[category];
  if (!counts || counts.total === 0) return [`No human-labeled examples for ${category}`];
  if (counts.evaluation === 0) {
    return [`${category} has only ${counts.total} example(s), so it is not represented in the held-out evaluation set`];
  }
  if (counts.total < 10) return [`${category} has only ${counts.total} examples; treat its metrics as preliminary`];
  return [];
});

const metadata = {
  version: 1,
  generated_at: new Date().toISOString(),
  source: "labeled-emails.json",
  seed,
  split_policy: "Per-category deterministic 20% holdout when a category has at least 5 examples; rarer categories remain in development.",
  distribution,
  manual_review_count: manualReview.length,
  warnings,
};

await Promise.all([
  writePrivateJson(resolve(outputDirectory, "jev-development.json"), {
    ...metadata,
    split: "development",
    emails: development,
  }),
  writePrivateJson(resolve(outputDirectory, "jev-evaluation.json"), {
    ...metadata,
    split: "evaluation",
    emails: evaluation,
  }),
  writePrivateJson(resolve(outputDirectory, "jev-manual-review.json"), {
    ...metadata,
    split: "manual_review",
    emails: manualReview,
  }),
  writePrivateJson(resolve(outputDirectory, "jev-prep-report.json"), metadata),
]);

console.log(
  JSON.stringify(
    {
      labeled: store.emails.length,
      development: development.length,
      evaluation: evaluation.length,
      manualReview: manualReview.length,
      distribution,
      warnings,
    },
    null,
    2,
  ),
);
