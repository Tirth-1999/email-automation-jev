import "dotenv/config";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, resolve } from "node:path";
import {
  LABEL_CATEGORIES,
  selectAdditionalSample,
  type LabelingEmail,
} from "../../lib/labeling-sample.js";
import {
  readAllActiveEmails,
  readJson,
  toReviewEmail,
  writePrivateJson,
  type LabeledStore,
  type ReviewBatch,
  type ReviewPool,
} from "../../lib/labeling-store.js";
import { createDatabaseClient } from "../../lib/repository.js";
import { CLASSIFIER_VERSION, JEV_CATEGORIES } from "../../lib/jev-classifier.js";
import {
  createProductionClassificationRun,
  previewClassificationSelection,
  RUN_SCOPES,
  runClassification,
  validateClassificationConfig,
  type ClassificationWorkerConfig,
  type RunScope,
} from "../../lib/classification-worker.js";
import {
  getClassificationRun,
  listRecentClassificationRuns,
  requestClassificationCancellation,
} from "../../lib/classification-repository.js";

const port = Number.parseInt(process.env.LABELING_UI_PORT || "4173", 10);
const projectRoot = process.cwd();
const uiRoot = resolve(projectRoot, "apps/dashboard");
const poolPath = resolve(projectRoot, "data/labeling/generated/email-review-pool.json");
const labelsPath = resolve(projectRoot, "data/labeling/generated/labeled-emails.json");
const benchmarkPath = resolve(
  projectRoot,
  "data/labeling/generated/jev-evaluation-results.json",
);
const allLabeledBenchmarkPath = resolve(
  projectRoot,
  "data/labeling/generated/jev-all-labeled-results.json",
);
const evaluationPath = resolve(
  projectRoot,
  "data/labeling/generated/jev-evaluation.json",
);

const routes = new Map<string, string>([
  ["/", resolve(uiRoot, "index.html")],
  ["/index.html", resolve(uiRoot, "index.html")],
  ["/src/styles.css", resolve(uiRoot, "src/styles.css")],
  ["/src/app.js", resolve(uiRoot, "src/app.js")],
  ["/sample.json", poolPath],
]);

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

await access(poolPath).catch(() => {
  throw new Error("Missing email-review-pool.json. Run `npm run sample:emails` first.");
});

const database = createDatabaseClient(
  required("SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
);
let emailCache: LabelingEmail[] | null = null;
let mutationQueue: Promise<unknown> = Promise.resolve();
const activeClassificationRuns = new Map<string, Promise<void>>();

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(`${JSON.stringify(value)}\n`);
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error("Request body is too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

async function labelsStore(): Promise<LabeledStore> {
  const exists = await access(labelsPath).then(
    () => true,
    () => false,
  );
  if (exists) return readJson<LabeledStore>(labelsPath);
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    categories: [...LABEL_CATEGORIES],
    emails: [],
  };
}

function serializeMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function primaryAccountId(): Promise<string> {
  const { data, error } = await database
    .from("gmail_accounts")
    .select("id")
    .order("created_at")
    .limit(1);
  if (error) throw new Error(`Could not load Gmail account: ${error.message}`);
  const account = (data || [])[0] as { id: string } | undefined;
  if (!account) throw new Error("No Gmail account is registered. Run ingestion first.");
  return account.id;
}

function workerConfig(input: Record<string, unknown>): ClassificationWorkerConfig {
  const config = {
    model:
      typeof input.model === "string" && input.model.trim()
        ? input.model.trim()
        : process.env.TYPESAFE_MODEL?.trim() || "jev-1.13.0",
    minimumTopProbability:
      typeof input.minimum_top_probability === "number"
        ? input.minimum_top_probability
        : Number(process.env.JEV_MIN_TOP_PROBABILITY || "0.6"),
    concurrency: typeof input.concurrency === "number" ? input.concurrency : 5,
    batchSize: typeof input.batch_size === "number" ? input.batch_size : 25,
    maxRetries: 6,
  };
  validateClassificationConfig(config);
  return config;
}

function startBackgroundClassification(runId: string, config: ClassificationWorkerConfig): void {
  if (activeClassificationRuns.has(runId)) return;
  const task = runClassification(database, runId, config)
    .then(() => undefined)
    .catch((error: unknown) => console.error(`Classification run ${runId} failed:`, error))
    .finally(() => activeClassificationRuns.delete(runId));
  activeClassificationRuns.set(runId, task);
}

async function saveLabel(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const input = await body(request);
  const emailId = typeof input.email_id === "string" ? input.email_id : "";
  const manualLabel = typeof input.manual_label === "string" ? input.manual_label : "";
  const notes = typeof input.review_notes === "string" ? input.review_notes.slice(0, 5_000) : "";
  if (!emailId || !LABEL_CATEGORIES.includes(manualLabel as never)) {
    json(response, 400, { error: "A valid email_id and manual_label are required" });
    return;
  }

  const result = await serializeMutation(async () => {
    const [pool, store] = await Promise.all([
      readJson<ReviewPool>(poolPath),
      labelsStore(),
    ]);
    const email = pool.emails.find((candidate) => candidate.email_id === emailId);
    if (!email) throw new Error("Email is not part of the review pool");
    const labeled = {
      ...email,
      manual_label: manualLabel,
      review_notes: notes,
      labeled_at: new Date().toISOString(),
    };
    const existingIndex = store.emails.findIndex((candidate) => candidate.email_id === emailId);
    if (existingIndex >= 0) store.emails[existingIndex] = labeled;
    else store.emails.push(labeled);
    store.updated_at = labeled.labeled_at;
    await writePrivateJson(labelsPath, store);
    return { labeled_count: store.emails.length, labeled_at: labeled.labeled_at };
  });
  json(response, 200, result);
}

async function addSample(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const input = await body(request);
  const count = typeof input.count === "number" ? input.count : 50;
  const strategy = input.strategy === "random" ? "random" : "balanced";
  if (!Number.isInteger(count) || count < 10 || count > 200) {
    json(response, 400, { error: "count must be an integer from 10 to 200" });
    return;
  }

  const result = await serializeMutation(async () => {
    const pool = await readJson<ReviewPool>(poolPath);
    if (!emailCache) emailCache = await readAllActiveEmails(database);
    const excluded = new Set(pool.emails.map((email) => email.email_id));
    const seed = `add-${Date.now()}-${randomUUID()}`;
    const selected = selectAdditionalSample(emailCache, excluded, count, seed, strategy);
    const now = new Date().toISOString();
    const batchId = `batch-${pool.batches.length + 1}-${randomUUID().slice(0, 8)}`;
    const additions = selected.map((email, index) =>
      toReviewEmail(
        email,
        pool.emails.length + index + 1,
        batchId,
        strategy === "balanced" ? "balanced_discovery" : "random",
      ),
    );
    const batch: ReviewBatch = {
      id: batchId,
      created_at: now,
      count: additions.length,
      strategy,
    };
    pool.emails.push(...additions);
    pool.batches.push(batch);
    pool.updated_at = now;
    pool.source_email_count = emailCache.length;
    await writePrivateJson(poolPath, pool);
    return {
      emails: additions,
      batch,
      total_count: pool.emails.length,
      unseen_remaining: emailCache.length - pool.emails.length,
    };
  });
  json(response, 200, result);
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host}`);
  const path = requestUrl.pathname;
  if (request.method === "GET" && path === "/api/command/preview") {
    const scopeValue = requestUrl.searchParams.get("scope") || "unclassified";
    if (!RUN_SCOPES.includes(scopeValue as RunScope)) {
      json(response, 400, { error: `scope must be one of: ${RUN_SCOPES.join(", ")}` });
      return;
    }
    const maximumValue = requestUrl.searchParams.get("maximum");
    const batchSizeValue = requestUrl.searchParams.get("batch_size");
    const preview = await previewClassificationSelection(
      database,
      await primaryAccountId(),
      {
        scope: scopeValue as RunScope,
        maximum: maximumValue ? Number(maximumValue) : null,
        after: requestUrl.searchParams.get("after"),
        before: requestUrl.searchParams.get("before"),
      },
      batchSizeValue ? Number(batchSizeValue) : 25,
    );
    json(response, 200, preview);
    return;
  }
  if (request.method === "GET" && path === "/api/command/status") {
    json(response, 200, { runs: await listRecentClassificationRuns(database) });
    return;
  }
  if (request.method === "POST" && path === "/api/command/runs") {
    const input = await body(request);
    const scopeValue = typeof input.scope === "string" ? input.scope : "unclassified";
    if (!RUN_SCOPES.includes(scopeValue as RunScope)) {
      json(response, 400, { error: `scope must be one of: ${RUN_SCOPES.join(", ")}` });
      return;
    }
    if (!process.env.TYPESAFE_API_KEY?.trim() || process.env.TYPESAFE_API_KEY === "replace_me") {
      json(response, 400, { error: "Set TYPESAFE_API_KEY before starting a classification run" });
      return;
    }
    const config = workerConfig(input);
    const created = await createProductionClassificationRun(
      database,
      await primaryAccountId(),
      {
        scope: scopeValue as RunScope,
        maximum: typeof input.maximum === "number" ? input.maximum : null,
        after: typeof input.after === "string" ? input.after : null,
        before: typeof input.before === "string" ? input.before : null,
      },
      config,
    );
    setImmediate(() => startBackgroundClassification(created.run.id, config));
    json(response, 202, { ...created.run, queued_email_count: created.queuedEmailCount });
    return;
  }
  if (request.method === "POST" && path === "/api/command/cancel") {
    const input = await body(request);
    const runId = typeof input.run_id === "string" ? input.run_id : "";
    if (!runId) {
      json(response, 400, { error: "run_id is required" });
      return;
    }
    await requestClassificationCancellation(database, runId);
    json(response, 202, { run_id: runId, cancellation_requested: true });
    return;
  }
  if (request.method === "POST" && path === "/api/command/resume") {
    const input = await body(request);
    const runId = typeof input.run_id === "string" ? input.run_id : "";
    if (!runId) {
      json(response, 400, { error: "run_id is required" });
      return;
    }
    if (!process.env.TYPESAFE_API_KEY?.trim() || process.env.TYPESAFE_API_KEY === "replace_me") {
      json(response, 400, { error: "Set TYPESAFE_API_KEY before resuming a classification run" });
      return;
    }
    const run = await getClassificationRun(database, runId);
    const config = workerConfig({
      model: run.model_requested,
      minimum_top_probability: Number(run.minimum_top_probability),
      concurrency: run.concurrency,
      batch_size: run.batch_size,
    });
    setImmediate(() => startBackgroundClassification(runId, config));
    json(response, 202, { run_id: runId, resumed: true });
    return;
  }
  if (request.method === "GET" && path === "/api/benchmark") {
    const allLabeled = requestUrl.searchParams.get("scope") === "all";
    const selectedBenchmarkPath = allLabeled ? allLabeledBenchmarkPath : benchmarkPath;
    const exists = await access(selectedBenchmarkPath).then(
      () => true,
      () => false,
    );
    if (exists) {
      const report = await readJson<{ classifier_version?: string }>(selectedBenchmarkPath);
      if (report.classifier_version === CLASSIFIER_VERSION) {
        json(response, 200, { status: "complete", report });
        return;
      }
      const evaluationCount = allLabeled
        ? (await labelsStore()).emails.filter((email) =>
            JEV_CATEGORIES.includes(email.manual_label as never),
          ).length
        : (await readJson<{ emails: unknown[] }>(evaluationPath)).emails.length;
      json(response, 200, {
        status: "stale",
        evaluation_count: evaluationCount,
        api_key_configured: Boolean(
          process.env.TYPESAFE_API_KEY?.trim() &&
            process.env.TYPESAFE_API_KEY !== "replace_me"
        ),
        command: allLabeled ? "npm run jev:evaluate:all" : "npm run jev:evaluate",
        current_classifier_version: CLASSIFIER_VERSION,
        result_classifier_version: report.classifier_version || "legacy-unversioned",
      });
      return;
    }
    const evaluationCount = allLabeled
      ? (await labelsStore()).emails.filter((email) =>
          JEV_CATEGORIES.includes(email.manual_label as never),
        ).length
      : (await readJson<{ emails: unknown[] }>(evaluationPath)).emails.length;
    json(response, 200, {
      status: "not_run",
      evaluation_count: evaluationCount,
      api_key_configured: Boolean(
        process.env.TYPESAFE_API_KEY?.trim() &&
          process.env.TYPESAFE_API_KEY !== "replace_me"
      ),
      command: allLabeled ? "npm run jev:evaluate:all" : "npm run jev:evaluate",
    });
    return;
  }
  if (request.method === "GET" && path === "/api/labels") {
    json(response, 200, await labelsStore());
    return;
  }
  if (request.method === "POST" && path === "/api/labels") {
    await saveLabel(request, response);
    return;
  }
  if (request.method === "POST" && path === "/api/resample") {
    await addSample(request, response);
    return;
  }

  const filePath = request.method === "GET" ? routes.get(path) : undefined;
  if (!filePath) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });
  createReadStream(filePath).pipe(response);
}

const server = createServer((request, response) => {
  void handle(request, response).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (!response.headersSent) json(response, 500, { error: message });
    else response.end();
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Email Automation Jev dashboard: http://127.0.0.1:${port}`);
  console.log("Labels save to private JSON. Press Ctrl+C to stop.");
});
