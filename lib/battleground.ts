import { performance } from "node:perf_hooks";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyEmailWithJev,
  type ClassifiableEmail,
  type JevClassification,
} from "./jev-classifier.js";
import { mapConcurrent } from "./classification-worker.js";

export interface BattlegroundConfig {
  sampleSize: number;
  concurrency: number;
  model: string;
  minimumTopProbability: number;
  maxRetries: number;
}

export interface BattlegroundEmail extends ClassifiableEmail {
  id: string;
  gmail_message_id: string;
  subject: string;
  snippet: string;
}

export interface BattlegroundResult {
  email_id: string;
  gmail_message_id: string;
  subject: string;
  sender: string;
  snippet: string;
  status: "succeeded" | "failed";
  category: string | null;
  decision: string | null;
  action: string | null;
  top_probability: number | null;
  input_tokens: number;
  database_ms: number;
  jev_ms: number;
  worker_ms: number;
  application_overhead_ms: number;
  error_type: string | null;
  http_status: number | null;
  error: string | null;
}

export interface BattlegroundMetrics {
  wall_ms: number;
  selection_ms: number;
  email_load_ms: number;
  classification_ms: number;
  throughput_per_second: number;
  successful_throughput_per_second: number;
  success_rate: number;
  rate_limited_count: number;
  average_jev_ms: number;
  p50_jev_ms: number;
  p95_jev_ms: number;
  average_application_overhead_ms: number;
  total_jev_ms: number;
  total_application_overhead_ms: number;
  total_input_tokens: number;
  projected_mailbox_seconds: number;
}

export interface BattlegroundDecisionSummary {
  category: string;
  count: number;
  average_confidence: number | null;
  low_confidence_count: number;
  medium_confidence_count: number;
  high_confidence_count: number;
}

export interface BattlegroundReport {
  id: string;
  status: "queued" | "running" | "succeeded" | "partial" | "failed";
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  config: BattlegroundConfig;
  active_mailbox_count: number;
  selected_count: number;
  completed_count: number;
  succeeded_count: number;
  failed_count: number;
  metrics: BattlegroundMetrics | null;
  results: BattlegroundResult[];
  error: string | null;
}

const EMAIL_FIELDS = "id,gmail_message_id,direction,from_name,from_email,to_recipients,subject,snippet,body_text,internal_date";
const PAGE_SIZE = 1_000;

export function validateBattlegroundConfig(config: BattlegroundConfig): void {
  if (!Number.isInteger(config.sampleSize) || config.sampleSize < 1 || config.sampleSize > 6_000) {
    throw new Error("sampleSize must be an integer from 1 to 6000");
  }
  if (!Number.isInteger(config.concurrency) || config.concurrency < 1 || config.concurrency > 500) {
    throw new Error("concurrency must be an integer from 1 to 500");
  }
  if (!Number.isInteger(config.maxRetries) || config.maxRetries < 0 || config.maxRetries > 6) {
    throw new Error("maxRetries must be an integer from 0 to 6");
  }
  if (!Number.isFinite(config.minimumTopProbability) || config.minimumTopProbability < 0 || config.minimumTopProbability > 1) {
    throw new Error("minimumTopProbability must be between 0 and 1");
  }
  if (!config.model.trim()) throw new Error("model is required");
}

export function randomSample<T>(values: T[], count: number, random = Math.random): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex] as T, shuffled[index] as T];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function percentile(values: number[], quantile: number): number {
  if (!values.length) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.ceil(quantile * ordered.length) - 1;
  return ordered[Math.max(0, Math.min(index, ordered.length - 1))] || 0;
}

export function summarizeBattlegroundDecisions(
  results: BattlegroundResult[],
): BattlegroundDecisionSummary[] {
  const groups = new Map<string, { count: number; confidences: number[]; low: number; medium: number; high: number }>();
  for (const result of results) {
    const category = result.status === "failed" ? "failed" : result.category || result.decision || "uncertain";
    const group = groups.get(category) || { count: 0, confidences: [], low: 0, medium: 0, high: 0 };
    group.count += 1;
    if (typeof result.top_probability === "number") {
      group.confidences.push(result.top_probability);
      if (result.top_probability < 0.6) group.low += 1;
      else if (result.top_probability < 0.8) group.medium += 1;
      else group.high += 1;
    }
    groups.set(category, group);
  }

  return [...groups.entries()]
    .map(([category, group]) => ({
      category,
      count: group.count,
      average_confidence: group.confidences.length
        ? group.confidences.reduce((sum, value) => sum + value, 0) / group.confidences.length
        : null,
      low_confidence_count: group.low,
      medium_confidence_count: group.medium,
      high_confidence_count: group.high,
    }))
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

export function calculateBattlegroundMetrics(
  results: BattlegroundResult[],
  wallMs: number,
  selectionMs: number,
  emailLoadMs: number,
  activeMailboxCount: number,
): BattlegroundMetrics {
  const completed = results.length;
  const succeeded = results.filter((result) => result.status === "succeeded").length;
  const rateLimited = results.filter((result) => result.http_status === 429 || result.error_type === "RateLimitError").length;
  const jevTimes = results.map((result) => result.jev_ms).filter((value) => value > 0);
  const totalJev = jevTimes.reduce((sum, value) => sum + value, 0);
  const totalOverhead = results.reduce((sum, result) => sum + result.application_overhead_ms, 0);
  const classificationMs = Math.max(0, wallMs - selectionMs - emailLoadMs);
  const throughput = classificationMs > 0 ? completed / (classificationMs / 1_000) : 0;
  return {
    wall_ms: rounded(wallMs),
    selection_ms: rounded(selectionMs),
    email_load_ms: rounded(emailLoadMs),
    classification_ms: rounded(classificationMs),
    throughput_per_second: rounded(throughput),
    successful_throughput_per_second: rounded(
      classificationMs > 0 ? succeeded / (classificationMs / 1_000) : 0,
    ),
    success_rate: completed ? Math.round((succeeded / completed) * 10_000) / 10_000 : 0,
    rate_limited_count: rateLimited,
    average_jev_ms: rounded(jevTimes.length ? totalJev / jevTimes.length : 0),
    p50_jev_ms: rounded(percentile(jevTimes, 0.5)),
    p95_jev_ms: rounded(percentile(jevTimes, 0.95)),
    average_application_overhead_ms: rounded(completed ? totalOverhead / completed : 0),
    total_jev_ms: rounded(totalJev),
    total_application_overhead_ms: rounded(totalOverhead),
    total_input_tokens: results.reduce((sum, result) => sum + result.input_tokens, 0),
    projected_mailbox_seconds: rounded(
      throughput > 0 && completed > 0
        ? selectionMs / 1_000 + (emailLoadMs / 1_000) * (activeMailboxCount / completed) + activeMailboxCount / throughput
        : 0,
    ),
  };
}

async function activeEmailIds(database: SupabaseClient, accountId: string): Promise<string[]> {
  const ids: string[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await database
      .from("emails")
      .select("id")
      .eq("gmail_account_id", accountId)
      .is("deleted_at", null)
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not select battleground emails: ${error.message}`);
    const rows = (data || []) as Array<{ id: string }>;
    ids.push(...rows.map((row) => row.id));
    if (rows.length < PAGE_SIZE) return ids;
  }
}

async function loadEmails(database: SupabaseClient, emailIds: string[]): Promise<Map<string, BattlegroundEmail>> {
  const chunkSize = 100;
  const chunks = Array.from(
    { length: Math.ceil(emailIds.length / chunkSize) },
    (_, index) => emailIds.slice(index * chunkSize, (index + 1) * chunkSize),
  );
  const pages: BattlegroundEmail[][] = [];
  await mapConcurrent(chunks, 10, async (ids) => {
    const { data, error } = await database
      .from("emails")
      .select(EMAIL_FIELDS)
      .in("id", ids)
      .is("deleted_at", null);
    if (error) throw new Error(`Could not bulk-load battleground emails: ${error.message}`);
    pages.push((data || []) as BattlegroundEmail[]);
  });
  return new Map(pages.flat().map((email) => [email.id, email]));
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
    .slice(0, 1_000);
}

function errorDetails(error: unknown): { type: string; status: number | null } {
  const value = error as { name?: unknown; status?: unknown };
  return {
    type: typeof value?.name === "string" ? value.name : "Error",
    status: typeof value?.status === "number" ? value.status : null,
  };
}

export async function runBattleground(
  database: SupabaseClient,
  accountId: string,
  report: BattlegroundReport,
  onProgress?: (report: BattlegroundReport) => void,
  classify?: (email: ClassifiableEmail) => Promise<JevClassification>,
): Promise<BattlegroundReport> {
  validateBattlegroundConfig(report.config);
  report.status = "running";
  report.started_at = new Date().toISOString();
  const wallStart = performance.now();
  try {
    const selectionStart = performance.now();
    const allIds = await activeEmailIds(database, accountId);
    const selectedIds = randomSample(allIds, report.config.sampleSize);
    const selectionMs = performance.now() - selectionStart;
    report.active_mailbox_count = allIds.length;
    report.selected_count = selectedIds.length;
    onProgress?.(report);

    const loadStart = performance.now();
    const emails = await loadEmails(database, selectedIds);
    const emailLoadMs = performance.now() - loadStart;
    const databaseMsPerEmail = selectedIds.length ? emailLoadMs / selectedIds.length : 0;

    const client = classify
      ? null
      : new TypeSafeClient({
          defaultModel: report.config.model,
          timeout: 30_000,
          retry: { maxRetries: report.config.maxRetries },
        });
    const classifyEmail = classify || ((email: ClassifiableEmail) =>
      classifyEmailWithJev(client as TypeSafeClient, email, {
        model: report.config.model,
        minimumTopProbability: report.config.minimumTopProbability,
      }));

    await mapConcurrent(selectedIds, report.config.concurrency, async (emailId) => {
      const workerStart = performance.now();
      let jevMs = 0;
      const email = emails.get(emailId) || null;
      try {
        if (!email) throw new Error(`Email ${emailId} disappeared before the Battleground run`);
        const jevStart = performance.now();
        let classification: JevClassification;
        try {
          classification = await classifyEmail(email);
        } finally {
          jevMs = performance.now() - jevStart;
        }
        const workerMs = databaseMsPerEmail + performance.now() - workerStart;
        report.results.push({
          email_id: email.id,
          gmail_message_id: email.gmail_message_id,
          subject: email.subject,
          sender: [email.from_name, email.from_email].filter(Boolean).join(" · ") || "Unknown",
          snippet: email.snippet,
          status: "succeeded",
          category: classification.category,
          decision: classification.decision,
          action: classification.action.choice,
          top_probability: classification.top_probability,
          input_tokens: classification.input_tokens,
          database_ms: rounded(databaseMsPerEmail),
          jev_ms: rounded(jevMs),
          worker_ms: rounded(workerMs),
          application_overhead_ms: rounded(Math.max(0, workerMs - jevMs)),
          error_type: null,
          http_status: null,
          error: null,
        });
        report.succeeded_count += 1;
      } catch (error) {
        const workerMs = databaseMsPerEmail + performance.now() - workerStart;
        const details = errorDetails(error);
        report.results.push({
          email_id: emailId,
          gmail_message_id: email?.gmail_message_id || "",
          subject: email?.subject || "Email could not be loaded",
          sender: email ? [email.from_name, email.from_email].filter(Boolean).join(" · ") || "Unknown" : "Unknown",
          snippet: email?.snippet || "",
          status: "failed",
          category: null,
          decision: null,
          action: null,
          top_probability: null,
          input_tokens: 0,
          database_ms: rounded(databaseMsPerEmail),
          jev_ms: rounded(jevMs),
          worker_ms: rounded(workerMs),
          application_overhead_ms: rounded(Math.max(0, workerMs - jevMs)),
          error_type: details.type,
          http_status: details.status,
          error: safeError(error),
        });
        report.failed_count += 1;
      }
      report.completed_count += 1;
      if (report.completed_count % 50 === 0 || report.completed_count === report.selected_count) {
        report.metrics = calculateBattlegroundMetrics(
          report.results,
          performance.now() - wallStart,
          selectionMs,
          emailLoadMs,
          report.active_mailbox_count,
        );
        onProgress?.(report);
      }
    });

    report.finished_at = new Date().toISOString();
    report.metrics = calculateBattlegroundMetrics(
      report.results,
      performance.now() - wallStart,
      selectionMs,
      emailLoadMs,
      report.active_mailbox_count,
    );
    report.status = report.failed_count === 0 ? "succeeded" : report.succeeded_count > 0 ? "partial" : "failed";
    onProgress?.(report);
    return report;
  } catch (error) {
    report.status = "failed";
    report.error = safeError(error);
    report.finished_at = new Date().toISOString();
    onProgress?.(report);
    return report;
  }
}
