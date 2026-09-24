import "dotenv/config";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCompanyCandidates,
  buildTitleCandidates,
  companyResolutionContextHash,
  isCompanyResolutionApplicationStatus,
  resolveApplicationCompanyWithJev,
  type CompanyResolutionContext,
  type CompanyResolutionMessage,
} from "../lib/company-resolution.js";
import { createDatabaseClient } from "../lib/repository.js";

const PAGE_SIZE = 1_000;
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value === "replace_me") throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function integerArgument(name: string, fallback: number): number {
  const inline = process.argv.find((argument) => argument.startsWith(`--${name}=`))?.split("=")[1];
  const position = process.argv.indexOf(`--${name}`);
  const raw = inline || (position >= 0 ? process.argv[position + 1] : undefined);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`--${name} must be a positive integer`);
  return value;
}

function numberArgument(name: string, fallback: number): number {
  const inline = process.argv.find((argument) => argument.startsWith(`--${name}=`))?.split("=")[1];
  const position = process.argv.indexOf(`--${name}`);
  const raw = inline || (position >= 0 ? process.argv[position + 1] : undefined);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`--${name} must be between 0 and 1`);
  return value;
}

async function allRows<T>(database: SupabaseClient, table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await database.from(table).select(columns).range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not load ${table}: ${error.message}`);
    const page = (data || []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function sanitizedError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
    .slice(0, 2_000);
}

async function mapConcurrent<T, U>(values: T[], concurrency: number, mapper: (value: T) => Promise<U>): Promise<U[]> {
  const output = new Array<U>(values.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      const value = values[index];
      if (value !== undefined) output[index] = await mapper(value);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return output;
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage:
  npm run companies:resolve -- [options]

Options:
  --limit NUMBER            Process a bounded validation set before the full corpus
  --concurrency NUMBER      Concurrent Jev requests (default 20)
  --batch-size NUMBER       Results saved in one Supabase upsert (default 100)
  --probability 0..1        Minimum employer top probability (default 0.80)
  --confidence 0..1         Minimum employer Choice confidence (default 0.65)
  --title-probability 0..1  Minimum title top probability (default 0.80)
  --title-confidence 0..1   Minimum title Choice confidence (default 0.65)
  --force                   Rerun rows whose source context is unchanged
  --model MODEL             Override TYPESAFE_MODEL

Only job-application states are processed; Other is excluded. The script writes only
application_company_resolutions and never overwrites applications.`);
  process.exit(0);
}

const database = createDatabaseClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"));
required("TYPESAFE_API_KEY");
const modelArgument = process.argv.find((argument) => argument.startsWith("--model="))?.split("=")[1];
const model = modelArgument || process.env.TYPESAFE_MODEL?.trim() || "jev-1.13.0";
const limit = integerArgument("limit", Number.MAX_SAFE_INTEGER);
const concurrency = Math.min(200, integerArgument("concurrency", Number(process.env.JEV_COMPANY_RESOLUTION_CONCURRENCY || "20")));
const batchSize = Math.min(500, integerArgument("batch-size", Number(process.env.JEV_COMPANY_RESOLUTION_BATCH_SIZE || "100")));
const minimumEmployerProbability = numberArgument("probability", Number(process.env.JEV_COMPANY_MIN_PROBABILITY || "0.80"));
const minimumEmployerConfidence = numberArgument("confidence", Number(process.env.JEV_COMPANY_MIN_CONFIDENCE || "0.65"));
const minimumTitleProbability = numberArgument("title-probability", Number(process.env.JEV_TITLE_MIN_PROBABILITY || "0.80"));
const minimumTitleConfidence = numberArgument("title-confidence", Number(process.env.JEV_TITLE_MIN_CONFIDENCE || "0.65"));
const force = process.argv.includes("--force");

console.log("Loading application contexts from Supabase...");
const [applications, links, emails, existing] = await Promise.all([
  allRows<{ id: string; gmail_account_id: string; company: string | null; role: string | null; requisition_id: string | null; current_status: string }>(
    database,
    "applications",
    "id,gmail_account_id,company,role,requisition_id,current_status",
  ),
  allRows<{ application_id: string; email_id: string }>(database, "application_messages", "application_id,email_id"),
  allRows<CompanyResolutionMessage>(
    database,
    "emails",
    "id,internal_date,direction,from_name,from_email,to_recipients,subject,snippet,body_text",
  ),
  allRows<{ application_id: string; context_hash: string; status: string }>(
    database,
    "application_company_resolutions",
    "application_id,context_hash,status",
  ).catch((error) => {
    throw new Error(`Could not load company-resolution staging. Apply migration 010 first. ${sanitizedError(error)}`);
  }),
]);

const messagesById = new Map(emails.map((email) => [email.id, email]));
const messageIdsByApplication = new Map<string, string[]>();
for (const link of links) {
  const ids = messageIdsByApplication.get(link.application_id) || [];
  ids.push(link.email_id);
  messageIdsByApplication.set(link.application_id, ids);
}
const existingByApplication = new Map(existing.map((row) => [row.application_id, row]));
const eligibleApplications = applications.filter((application) => isCompanyResolutionApplicationStatus(application.current_status));
const contexts = eligibleApplications.map((application): CompanyResolutionContext => ({
  applicationId: application.id,
  gmailAccountId: application.gmail_account_id,
  currentCompany: application.company,
  currentRole: application.role,
  requisitionId: application.requisition_id,
  messages: (messageIdsByApplication.get(application.id) || [])
    .map((emailId) => messagesById.get(emailId))
    .filter((email): email is CompanyResolutionMessage => Boolean(email)),
}));

const needingResolution = contexts.filter((context) => {
  if (force) return true;
  const candidateSet = buildCompanyCandidates(context);
  const titleCandidateSet = buildTitleCandidates(context);
  const hash = companyResolutionContextHash(context, candidateSet, titleCandidateSet);
  const previous = existingByApplication.get(context.applicationId);
  return !previous || previous.context_hash !== hash || !["succeeded", "uncertain"].includes(previous.status);
});
const pending = needingResolution.slice(0, limit);

console.log(JSON.stringify({
  applications: applications.length,
  eligible_applications: eligibleApplications.length,
  excluded_non_job_applications: applications.length - eligibleApplications.length,
  linked_emails: links.length,
  already_current: contexts.length - needingResolution.length,
  deferred_by_limit: needingResolution.length - pending.length,
  selected_for_resolution: pending.length,
  model,
  concurrency,
  batch_size: batchSize,
  minimum_employer_probability: minimumEmployerProbability,
  minimum_employer_confidence: minimumEmployerConfidence,
  minimum_title_probability: minimumTitleProbability,
  minimum_title_confidence: minimumTitleConfidence,
}, null, 2));

const client = new TypeSafeClient({
  defaultModel: model,
  timeout: 45_000,
  retry: { maxRetries: 4 },
});
let processed = 0;
let succeeded = 0;
let uncertain = 0;
let failed = 0;
let inputTokens = 0;

for (let offset = 0; offset < pending.length; offset += batchSize) {
  const batch = pending.slice(offset, offset + batchSize);
  const startedAt = new Date().toISOString();
  const queuedRows = batch.map((context) => {
    const candidates = buildCompanyCandidates(context);
    const titleCandidates = buildTitleCandidates(context);
    return {
      application_id: context.applicationId,
      gmail_account_id: context.gmailAccountId,
      status: "running",
      context_hash: companyResolutionContextHash(context, candidates, titleCandidates),
      candidate_set: candidates,
      title_candidate_set: titleCandidates,
      started_at: startedAt,
      finished_at: null,
      error_message: null,
    };
  });
  const queuedResult = await database.from("application_company_resolutions").upsert(queuedRows, { onConflict: "application_id" });
  if (queuedResult.error) throw new Error(`Could not stage company-resolution batch: ${queuedResult.error.message}`);

  const resultRows = await mapConcurrent(batch, concurrency, async (context) => {
    try {
      const result = await resolveApplicationCompanyWithJev(client, context, {
        model,
        minimumEmployerProbability,
        minimumEmployerConfidence,
        minimumTitleProbability,
        minimumTitleConfidence,
      });
      inputTokens += result.inputTokens;
      if (result.needsLlmReview) uncertain += 1;
      else succeeded += 1;
      return {
        application_id: context.applicationId,
        gmail_account_id: context.gmailAccountId,
        status: result.needsLlmReview ? "uncertain" : "succeeded",
        context_hash: result.contextHash,
        candidate_set: result.candidates,
        title_candidate_set: result.titleCandidates,
        employer_candidate_id: result.employer.candidateId,
        employer_name: result.employer.name,
        employer_confidence: result.employer.confidence,
        employer_top_probability: result.employer.topProbability,
        employer_probabilities: result.employer.probabilities,
        title_candidate_id: result.title.candidateId,
        title_name: result.title.name,
        title_confidence: result.title.confidence,
        title_top_probability: result.title.topProbability,
        title_probabilities: result.title.probabilities,
        agency_candidate_id: result.agency.candidateId,
        agency_name: result.agency.name,
        agency_confidence: result.agency.confidence,
        agency_probabilities: result.agency.probabilities,
        platform_candidate_id: result.platform.candidateId,
        platform_name: result.platform.name,
        platform_confidence: result.platform.confidence,
        platform_probabilities: result.platform.probabilities,
        company_needs_llm_review: result.companyNeedsLlmReview,
        title_needs_llm_review: result.titleNeedsLlmReview,
        needs_llm_review: result.needsLlmReview,
        model: result.model,
        input_tokens: result.inputTokens,
        error_message: null,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      };
    } catch (error) {
      failed += 1;
      const candidates = buildCompanyCandidates(context);
      const titleCandidates = buildTitleCandidates(context);
      return {
        application_id: context.applicationId,
        gmail_account_id: context.gmailAccountId,
        status: "failed",
        context_hash: companyResolutionContextHash(context, candidates, titleCandidates),
        candidate_set: candidates,
        title_candidate_set: titleCandidates,
        company_needs_llm_review: true,
        title_needs_llm_review: true,
        needs_llm_review: true,
        model,
        input_tokens: 0,
        error_message: sanitizedError(error),
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      };
    }
  });
  const saveResult = await database.from("application_company_resolutions").upsert(resultRows, { onConflict: "application_id" });
  if (saveResult.error) throw new Error(`Could not save company-resolution batch: ${saveResult.error.message}`);
  processed += batch.length;
  console.log(`Resolved ${processed.toLocaleString()} / ${pending.length.toLocaleString()} · accepted ${succeeded.toLocaleString()} · uncertain ${uncertain.toLocaleString()} · failed ${failed.toLocaleString()}`);
}

console.log(JSON.stringify({ processed, succeeded, uncertain, failed, input_tokens: inputTokens }, null, 2));
