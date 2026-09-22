import "dotenv/config";
import { resolve } from "node:path";
import { createDatabaseClient } from "../lib/repository.js";
import {
  approveClassifierVersion,
  createClassifierVersion,
  findClassifierVersion,
} from "../lib/classification-repository.js";
import {
  benchmarkSummary,
  humanDatasetVersion,
  humanLabelImportRows,
} from "../lib/classification-bootstrap.js";
import {
  CLASSIFIER_QUESTIONS,
  CLASSIFIER_VERSION,
} from "../lib/jev-classifier.js";
import {
  readJson,
  type LabeledStore,
} from "../lib/labeling-store.js";
import type { JsonObject } from "../lib/classification-types.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const projectRoot = process.cwd();
const labels = await readJson<LabeledStore>(
  resolve(projectRoot, "data/labeling/generated/labeled-emails.json"),
);
const benchmark = await readJson<JsonObject>(
  resolve(projectRoot, "data/labeling/generated/jev-evaluation-results.json"),
);
if (benchmark.classifier_version !== CLASSIFIER_VERSION) {
  throw new Error(
    `Held-out benchmark is for ${String(benchmark.classifier_version)}, not ${CLASSIFIER_VERSION}`,
  );
}

const database = createDatabaseClient(
  required("SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
);
const rows = humanLabelImportRows(labels.emails);
const emailIds = [...new Set(rows.map((row) => row.email_id))];
const { data: existingEmails, error: emailError } = await database
  .from("emails")
  .select("id")
  .in("id", emailIds);
if (emailError) throw new Error(`Could not verify labeled emails: ${emailError.message}`);
const existingIds = new Set((existingEmails || []).map((row) => (row as { id: string }).id));
const missingIds = emailIds.filter((id) => !existingIds.has(id));
if (missingIds.length > 0) {
  throw new Error(`${missingIds.length} labeled emails are missing from Supabase; no labels were imported`);
}

const { data: insertedLabels, error: labelError } = await database
  .from("email_human_label_events")
  .upsert(rows, { onConflict: "source_key", ignoreDuplicates: true })
  .select("id");
if (labelError) throw new Error(`Could not import human labels: ${labelError.message}`);

let classifier = await findClassifierVersion(database, CLASSIFIER_VERSION);
if (!classifier) {
  classifier = await createClassifierVersion(database, {
    version: CLASSIFIER_VERSION,
    model_requested: String(benchmark.model_requested || process.env.TYPESAFE_MODEL || "jev-latest"),
    question_config: JSON.parse(JSON.stringify(CLASSIFIER_QUESTIONS)) as JsonObject,
    composition_policy: {
      uncertain_when_top_probability_below: Number(benchmark.minimum_top_probability || 0.6),
      draft_requires_category: "reply_needed",
      draft_probability_threshold: Number(process.env.JEV_DRAFT_REPLY_THRESHOLD || 0.65),
    },
    source_dataset_version: humanDatasetVersion(labels.emails),
    reference_config: {
      strategy: "structured-criteria",
      development_examples: 160,
      held_out_examples: 39,
      held_out_examples_in_prompt: false,
    },
  });
}
if (classifier.status === "draft") {
  classifier = await approveClassifierVersion(database, classifier.id, benchmarkSummary(benchmark));
}

console.log(
  JSON.stringify(
    {
      human_labels_total: rows.length,
      human_labels_inserted: insertedLabels?.length || 0,
      classifier_version: classifier.version,
      classifier_status: classifier.status,
      source_dataset_version: classifier.source_dataset_version,
    },
    null,
    2,
  ),
);
