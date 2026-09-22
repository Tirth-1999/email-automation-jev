import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  GmailAccountRow,
  NormalizedEmail,
  SyncCounts,
  SyncType,
} from "./types.js";

type DatabaseClient = SupabaseClient;

function assertNoError(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]").slice(0, 2_000);
}

export function createDatabaseClient(url: string, serviceRoleKey: string): DatabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function ensureGmailAccount(
  database: DatabaseClient,
  gmailAddress: string,
): Promise<GmailAccountRow> {
  const normalizedAddress = gmailAddress.toLowerCase();
  const { data, error } = await database
    .from("gmail_accounts")
    .upsert(
      { gmail_address: normalizedAddress },
      { onConflict: "gmail_address", ignoreDuplicates: false },
    )
    .select("id,gmail_address,latest_history_id")
    .single();
  assertNoError(error, "Could not create or load Gmail account");
  return data as GmailAccountRow;
}

export async function startSyncRun(
  database: DatabaseClient,
  accountId: string,
  syncType: SyncType,
): Promise<string> {
  const accountResult = await database
    .from("gmail_accounts")
    .update({ sync_status: "running", last_error: null })
    .eq("id", accountId);
  assertNoError(accountResult.error, "Could not mark account as syncing");

  const { data, error } = await database
    .from("sync_runs")
    .insert({ gmail_account_id: accountId, sync_type: syncType })
    .select("id")
    .single();
  assertNoError(error, "Could not create sync run");
  return (data as { id: string }).id;
}

export async function upsertEmails(
  database: DatabaseClient,
  accountId: string,
  emails: NormalizedEmail[],
): Promise<{ inserted: number; updated: number }> {
  if (emails.length === 0) return { inserted: 0, updated: 0 };

  const messageIds = emails.map((email) => email.gmail_message_id);
  const existingResult = await database
    .from("emails")
    .select("gmail_message_id")
    .eq("gmail_account_id", accountId)
    .in("gmail_message_id", messageIds);
  assertNoError(existingResult.error, "Could not inspect existing messages");
  const existing = new Set(
    (existingResult.data || []).map(
      (row) => (row as { gmail_message_id: string }).gmail_message_id,
    ),
  );

  const rows = emails.map((email) => ({
    gmail_account_id: accountId,
    ...email,
  }));
  const upsertResult = await database.from("emails").upsert(rows, {
    onConflict: "gmail_account_id,gmail_message_id",
    ignoreDuplicates: false,
  });
  assertNoError(upsertResult.error, "Could not upsert messages");

  const updated = messageIds.filter((id) => existing.has(id)).length;
  return { inserted: messageIds.length - updated, updated };
}

export async function findExistingMessageIds(
  database: DatabaseClient,
  accountId: string,
  messageIds: string[],
): Promise<Set<string>> {
  if (messageIds.length === 0) return new Set();
  const { data, error } = await database
    .from("emails")
    .select("gmail_message_id")
    .eq("gmail_account_id", accountId)
    .in("gmail_message_id", messageIds);
  assertNoError(error, "Could not inspect existing messages for resume");
  return new Set(
    (data || []).map(
      (row) => (row as { gmail_message_id: string }).gmail_message_id,
    ),
  );
}

export async function markMessagesDeleted(
  database: DatabaseClient,
  accountId: string,
  messageIds: string[],
): Promise<number> {
  if (messageIds.length === 0) return 0;
  const { data, error } = await database
    .from("emails")
    .update({ deleted_at: new Date().toISOString() })
    .eq("gmail_account_id", accountId)
    .in("gmail_message_id", messageIds)
    .is("deleted_at", null)
    .select("gmail_message_id");
  assertNoError(error, "Could not mark deleted messages");
  return data?.length || 0;
}

export async function completeSyncRun(
  database: DatabaseClient,
  options: {
    accountId: string;
    runId: string;
    historyId: string;
    counts: SyncCounts;
  },
): Promise<void> {
  const finishedAt = new Date().toISOString();
  const runResult = await database
    .from("sync_runs")
    .update({
      status: "succeeded",
      finished_at: finishedAt,
      discovered_count: options.counts.discovered,
      inserted_count: options.counts.inserted,
      updated_count: options.counts.updated,
      deleted_count: options.counts.deleted,
      skipped_count: options.counts.skipped,
    })
    .eq("id", options.runId);
  assertNoError(runResult.error, "Could not complete sync run");

  const accountResult = await database
    .from("gmail_accounts")
    .update({
      latest_history_id: options.historyId,
      last_synced_at: finishedAt,
      sync_status: "idle",
      last_error: null,
    })
    .eq("id", options.accountId);
  assertNoError(accountResult.error, "Could not advance Gmail history cursor");
}

export async function failSyncRun(
  database: DatabaseClient,
  options: { accountId: string; runId: string; error: unknown; counts: SyncCounts },
): Promise<void> {
  const errorMessage = safeErrorMessage(options.error);
  const finishedAt = new Date().toISOString();
  const [runResult, accountResult] = await Promise.all([
    database
      .from("sync_runs")
      .update({
        status: "failed",
        finished_at: finishedAt,
        discovered_count: options.counts.discovered,
        inserted_count: options.counts.inserted,
        updated_count: options.counts.updated,
        deleted_count: options.counts.deleted,
        skipped_count: options.counts.skipped,
        error_message: errorMessage,
      })
      .eq("id", options.runId),
    database
      .from("gmail_accounts")
      .update({ sync_status: "error", last_error: errorMessage })
      .eq("id", options.accountId),
  ]);
  assertNoError(runResult.error, "Could not record failed sync run");
  assertNoError(accountResult.error, "Could not mark Gmail account as failed");
}
