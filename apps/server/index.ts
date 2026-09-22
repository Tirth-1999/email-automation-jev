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
