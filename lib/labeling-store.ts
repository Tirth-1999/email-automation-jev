import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LabelingEmail } from "./labeling-sample.js";

export interface ReviewEmail {
  sample_index: number;
  batch_id: string;
  email_id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  internal_date: string;
  direction: "incoming" | "outgoing" | "unknown";
  from_name: string | null;
  from_email: string | null;
  to_recipients: LabelingEmail["to_recipients"];
  subject: string;
  snippet: string;
  body_text: string;
  gmail_label_ids: string[];
  selection_reason: string;
}

export interface ReviewBatch {
  id: string;
  created_at: string;
  count: number;
  strategy: "initial" | "balanced" | "random";
}

export interface ReviewPool {
  version: 3;
  created_at: string;
  updated_at: string;
  source_email_count: number;
  categories: string[];
  batches: ReviewBatch[];
  emails: ReviewEmail[];
}

export interface LabeledEmail extends ReviewEmail {
  manual_label: string;
  review_notes: string;
  labeled_at: string;
}

export interface LabeledStore {
  version: 1;
  updated_at: string;
  categories: string[];
  emails: LabeledEmail[];
}

export async function readAllActiveEmails(
  database: SupabaseClient,
  onProgress?: (seen: number, total: number | null) => void,
): Promise<LabelingEmail[]> {
  const pageSize = 500;
  const emails: LabelingEmail[] = [];
  let offset = 0;
  let total: number | null = null;

  while (true) {
    const { data, error, count } = await database
      .from("emails")
      .select(
        "id,gmail_message_id,gmail_thread_id,internal_date,direction,from_name,from_email,to_recipients,subject,snippet,body_text,label_ids",
        offset === 0 ? { count: "exact" } : undefined,
      )
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Could not read emails: ${error.message}`);
    if (offset === 0) total = count;
    const rows = (data || []) as LabelingEmail[];
    emails.push(...rows);
    onProgress?.(emails.length, total);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return emails;
}

export function toReviewEmail(
  email: LabelingEmail,
  index: number,
  batchId: string,
  selectionReason: string,
  bodyCharacters = 20_000,
): ReviewEmail {
  const body =
    email.body_text.length <= bodyCharacters
      ? email.body_text
      : `${email.body_text.slice(0, bodyCharacters)}\n\n[Body truncated for labeling sample]`;
  return {
    sample_index: index,
    batch_id: batchId,
    email_id: email.id,
    gmail_message_id: email.gmail_message_id,
    gmail_thread_id: email.gmail_thread_id,
    internal_date: email.internal_date,
    direction: email.direction,
    from_name: email.from_name,
    from_email: email.from_email,
    to_recipients: email.to_recipients,
    subject: email.subject,
    snippet: email.snippet,
    body_text: body,
    gmail_label_ids: email.label_ids,
    selection_reason: selectionReason,
  };
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function writePrivateJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
}
