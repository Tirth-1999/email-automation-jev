import "dotenv/config";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import {
  LABEL_CATEGORIES,
  selectLabelingSample,
  type LabelingEmail,
} from "../lib/labeling-sample.js";
import {
  readAllActiveEmails,
  toReviewEmail,
  writePrivateJson,
  type ReviewPool,
} from "../lib/labeling-store.js";
import { createDatabaseClient } from "../lib/repository.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function positiveArgument(name: string, fallback: number): number {
  const raw = argument(name);
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return value;
}

async function main(): Promise<void> {
  const sampleSize = positiveArgument("count", 150);
  const bodyCharacters = positiveArgument("body-chars", 20_000);
  const seed = argument("seed") || "phase-2-ui-sample-v2";
  const force = process.argv.includes("--force");
  const outputPath = resolve(
    process.cwd(),
    "data/labeling/generated/email-review-pool.json",
  );
  const outputExists = await access(outputPath).then(
    () => true,
    () => false,
  );
  if (outputExists && !force) {
    throw new Error(
      "The review pool already exists. Use the UI's Add emails button so existing reviews are preserved.",
    );
  }
  const database = createDatabaseClient(
    required("SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
  );
  console.log(`Reading active emails from Supabase (seed: ${seed})`);
  const emails: LabelingEmail[] = await readAllActiveEmails(database, (seen, total) => {
    console.log(`Scanned ${seen}/${total ?? "?"} emails`);
  });

  if (emails.length < sampleSize) {
    throw new Error(
      `Only ${emails.length} active emails exist; cannot create a ${sampleSize}-email sample`,
    );
  }

  const selected = selectLabelingSample(emails, sampleSize, seed);
  const now = new Date().toISOString();
  const batchId = `initial-${seed}`;
  const sample = selected.map((email, index) =>
    toReviewEmail(
      email,
      index + 1,
      batchId,
      email.selection_reason,
      bodyCharacters,
    ),
  );
  const pool: ReviewPool = {
    version: 3,
    created_at: now,
    updated_at: now,
    source_email_count: emails.length,
    categories: [...LABEL_CATEGORIES],
    batches: [{ id: batchId, created_at: now, count: sample.length, strategy: "initial" }],
    emails: sample,
  };
  await writePrivateJson(outputPath, pool);

  const atcCount = sample.filter(
    (email) => email.selection_reason === "atc_required",
  ).length;
  const outgoingCount = sample.filter((email) => email.direction === "outgoing").length;
  console.table({
    sourceEmails: emails.length,
    sampleSize: sample.length,
    atcRequired: atcCount,
    random: sample.length - atcCount,
    incoming: sample.length - outgoingCount,
    outgoing: outgoingCount,
  });
  console.log(`Private UI dataset: ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
