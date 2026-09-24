import "dotenv/config";
import {
  createProductionClassificationRun,
  RUN_SCOPES,
  runClassification,
  type ClassificationWorkerConfig,
  type RunScope,
} from "../lib/classification-worker.js";
import { getClassificationRun } from "../lib/classification-repository.js";
import { createDatabaseClient } from "../lib/repository.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value === "replace_me") throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function integerArgument(name: string, fallback: number): number {
  const raw = argument(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new Error(`--${name} must be an integer`);
  return value;
}

function numberArgument(name: string, fallback: number): number {
  const raw = argument(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`--${name} must be a number`);
  return value;
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage:
  npm run classify -- [options]

Create a durable run:
  --scope unclassified|all|uncertain|failed
  --limit NUMBER
  --after ISO_TIMESTAMP
  --before ISO_TIMESTAMP
  --threshold 0..1
  --concurrency 1..10
  --batch-size 1..250
  --max-retries 0..6
  --model MODEL

Resume only the queued rows in an existing run:
  --run-id RUN_UUID

Important:
  --scope all is a destructive fresh rebuild for the selected Gmail account.
  It deletes prior classification runs/results and clears current human and AI
  classification overrides before creating the new run. Saved drafts, stars,
  and the private human-labeled evaluation JSON are preserved. Full scope cannot
  be combined with --limit, --after, or --before.`);
  process.exit(0);
}

const database = createDatabaseClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"));
const runId = argument("run-id");
const model = argument("model") || process.env.TYPESAFE_MODEL?.trim() || "jev-1.13.0";
const config: ClassificationWorkerConfig = {
  model,
  minimumTopProbability: numberArgument(
    "threshold",
    Number(process.env.JEV_MIN_TOP_PROBABILITY || "0.6"),
  ),
  concurrency: integerArgument("concurrency", 5),
  batchSize: integerArgument("batch-size", 25),
  maxRetries: integerArgument("max-retries", 6),
};

let activeRunId = runId;
if (!activeRunId) {
  const scopeValue = argument("scope") || "unclassified";
  if (!RUN_SCOPES.includes(scopeValue as RunScope)) {
    throw new Error(`--scope must be one of: ${RUN_SCOPES.join(", ")}`);
  }
  const { data: accounts, error } = await database
    .from("gmail_accounts")
    .select("id,gmail_address")
    .order("created_at")
    .limit(1);
  if (error) throw new Error(`Could not load Gmail account: ${error.message}`);
  const account = (accounts || [])[0] as { id: string; gmail_address: string } | undefined;
  if (!account) throw new Error("No Gmail account is registered. Run ingestion first.");
  const maximumRaw = argument("limit");
  const maximum = maximumRaw === undefined ? null : Number(maximumRaw);
  const created = await createProductionClassificationRun(
    database,
    account.id,
    {
      scope: scopeValue as RunScope,
      maximum,
      after: argument("after") || null,
      before: argument("before") || null,
    },
    config,
  );
  activeRunId = created.run.id;
  console.log(JSON.stringify({ run_id: activeRunId, queued_email_count: created.queuedEmailCount }, null, 2));
} else {
  const run = await getClassificationRun(database, activeRunId);
  config.model = run.model_requested;
  config.minimumTopProbability = Number(run.minimum_top_probability);
  config.concurrency = run.concurrency;
  config.batchSize = run.batch_size;
}

required("TYPESAFE_API_KEY");
const completed = await runClassification(database, activeRunId, config);
console.log(JSON.stringify(completed, null, 2));
