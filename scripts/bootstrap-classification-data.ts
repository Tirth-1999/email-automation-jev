import "dotenv/config";
import { resolve } from "node:path";
import { createDatabaseClient } from "../lib/repository.js";
import {
  humanDatasetVersion,
  humanLabelImportRows,
} from "../lib/classification-bootstrap.js";
import { CLASSIFIER_VERSION } from "../lib/jev-classifier.js";
import {
  readJson,
  type LabeledStore,
} from "../lib/labeling-store.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const projectRoot = process.cwd();
const labels = await readJson<LabeledStore>(
  resolve(projectRoot, "data/labeling/generated/labeled-emails.json"),
);
const database = createDatabaseClient(
  required("SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
);
const rows = humanLabelImportRows(labels.emails);
let saved = 0;
let cursor = 0;
async function worker(): Promise<void> {
  while (cursor < rows.length) {
    const row = rows[cursor];
    cursor += 1;
    if (!row) continue;
    const { data, error } = await database
      .from("emails")
      .update({
        human_category: row.category ?? null,
        human_next_action: row.next_action ?? null,
        human_urgency_level: row.urgency_level ?? null,
        human_draft_needed: row.draft_needed ?? null,
        human_label_source: row.source,
        human_label_source_key: row.source_key ?? null,
        human_label_notes: row.notes || "",
        human_labeled_at: labels.emails.find((email) => email.email_id === row.email_id)?.labeled_at || new Date().toISOString(),
      })
      .eq("id", row.email_id)
      .select("id");
    if (error) throw new Error(`Could not save human label for ${row.email_id}: ${error.message}`);
    if (!data?.length) throw new Error(`Labeled email ${row.email_id} is missing from Supabase`);
    saved += 1;
  }
}
await Promise.all(Array.from({ length: Math.min(10, rows.length) }, worker));

console.log(
  JSON.stringify(
    {
      human_labels_total: rows.length,
      human_labels_saved: saved,
      classifier_version: CLASSIFIER_VERSION,
      source_dataset_version: humanDatasetVersion(labels.emails),
    },
    null,
    2,
  ),
);
