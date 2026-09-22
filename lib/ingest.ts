import type { gmail_v1 } from "googleapis";
import type { GmailRequestRunner } from "./gmail.js";
import {
  fetchMessages,
  isExpiredHistoryError,
  listFullSyncMessagePages,
  listIncrementalChanges,
} from "./gmail.js";
import { normalizeGmailMessage } from "./parse-email.js";
import {
  completeSyncRun,
  failSyncRun,
  findExistingMessageIds,
  markMessagesDeleted,
  startSyncRun,
  upsertEmails,
} from "./repository.js";
import type { GmailAccountRow, SyncCounts, SyncType } from "./types.js";
import type { SupabaseClient } from "@supabase/supabase-js";

interface IngestionOptions {
  database: SupabaseClient;
  gmail: gmail_v1.Gmail;
  requests: GmailRequestRunner;
  account: GmailAccountRow;
  profileHistoryId: string;
  forceFull: boolean;
  resumeFull: boolean;
  query: string;
  includeSpamTrash: boolean;
  includeOutgoing: boolean;
  maxMessages: number;
  fetchConcurrency: number;
  upsertBatchSize: number;
  onProgress?: (
    message: string,
    stats?: Partial<IngestionLiveStats>,
  ) => void;
}

export interface IngestionLiveStats {
  stage: "starting" | "catching_up" | "discovering" | "comparing" | "fetching" | "finalizing";
  page: number;
  iteration: number;
  discovered: number;
  existing: number;
  pending: number;
  inserted: number;
  updated: number;
  skipped: number;
  deleted: number;
}

export interface IngestionResult {
  syncType: SyncType;
  counts: SyncCounts;
  historyId: string;
}

function emptyCounts(): SyncCounts {
  return { discovered: 0, inserted: 0, updated: 0, deleted: 0, skipped: 0 };
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function persistMessageIds(
  options: IngestionOptions,
  ids: string[],
  counts: SyncCounts,
): Promise<void> {
  let iteration = 0;
  let processed = 0;
  for (const idBatch of chunks(ids, Math.max(options.upsertBatchSize, 1))) {
    iteration += 1;

    const fetched = await fetchMessages(
      options.gmail,
      idBatch,
      options.fetchConcurrency,
      options.requests,
    );
    if (fetched.missingIds.length > 0) {
      counts.deleted += await markMessagesDeleted(
        options.database,
        options.account.id,
        fetched.missingIds,
      );
    }

    const parsed = fetched.messages.map((message) =>
      normalizeGmailMessage(message, options.account.gmail_address),
    );
    const normalized = parsed.filter((email) => {
      const shouldSkip =
        email.label_ids.includes("DRAFT") ||
        (!options.includeOutgoing && email.direction === "outgoing");
      if (shouldSkip) counts.skipped += 1;
      return !shouldSkip;
    });
    const saved = await upsertEmails(
      options.database,
      options.account.id,
      normalized,
    );
    counts.inserted += saved.inserted;
    counts.updated += saved.updated;
    processed += idBatch.length;
    options.onProgress?.(
      `Database writes: ${counts.inserted + counts.updated}; already stored or filtered: ${counts.skipped}; discovered: ${counts.discovered}`,
      {
        stage: "fetching",
        iteration,
        pending: Math.max(0, ids.length - processed),
        inserted: counts.inserted,
        updated: counts.updated,
        skipped: counts.skipped,
        deleted: counts.deleted,
      },
    );
  }
}

async function executeFullSync(
  options: IngestionOptions,
  syncType: "full" | "recovery_full",
): Promise<IngestionResult> {
  const counts = emptyCounts();
  const runId = await startSyncRun(options.database, options.account.id, syncType);

  try {
    const discoveredIds = new Set<string>();
    let page = 0;
    for await (const ids of listFullSyncMessagePages(options.gmail, {
      query: options.query,
      includeSpamTrash: options.includeSpamTrash,
      maxMessages: options.maxMessages,
    }, options.requests)) {
      page += 1;
      for (const id of ids) discoveredIds.add(id);
      options.onProgress?.(`Discovered ${discoveredIds.size} message IDs`, {
        stage: "discovering",
        page,
        discovered: discoveredIds.size,
      });
    }

    const initialIds = [...discoveredIds];
    counts.discovered = initialIds.length;
    options.onProgress?.(
      `Discovery complete: ${counts.discovered} unique messages match the mailbox query`,
    );
    const existingIds = new Set<string>();
    let comparisonIteration = 0;
    for (const idBatch of chunks(initialIds, Math.max(options.upsertBatchSize, 1))) {
      comparisonIteration += 1;
      const existingBatch = await findExistingMessageIds(
        options.database,
        options.account.id,
        idBatch,
      );
      for (const id of existingBatch) existingIds.add(id);
      options.onProgress?.(
        `Compared ${Math.min(comparisonIteration * options.upsertBatchSize, initialIds.length)}/${initialIds.length} IDs with Supabase`,
        {
          stage: "comparing",
          iteration: comparisonIteration,
          existing: existingIds.size,
          pending: options.resumeFull
            ? initialIds.length - existingIds.size
            : initialIds.length,
        },
      );
    }

    const idsToFetch = options.resumeFull
      ? initialIds.filter((id) => !existingIds.has(id))
      : initialIds;
    if (options.resumeFull) counts.skipped += existingIds.size;
    options.onProgress?.(
      options.resumeFull
        ? `${idsToFetch.length} missing messages require full content`
        : `${initialIds.length} messages will be refreshed`,
      {
        stage: "fetching",
        existing: existingIds.size,
        pending: idsToFetch.length,
        skipped: counts.skipped,
      },
    );
    await persistMessageIds(options, idsToFetch, counts);

    options.onProgress?.(
      "Checking Gmail history for messages that changed during the full import",
      { stage: "catching_up", pending: 0 },
    );
    const catchUp = await listIncrementalChanges(
      options.gmail,
      options.profileHistoryId,
      options.requests,
    );
    const catchUpIds = catchUp.changedMessageIds.filter(
      (id) => !discoveredIds.has(id),
    );
    counts.discovered += catchUpIds.length;
    await persistMessageIds(options, catchUp.changedMessageIds, counts);
    counts.deleted += await markMessagesDeleted(
      options.database,
      options.account.id,
      catchUp.deletedMessageIds,
    );

    options.onProgress?.("Finalizing sync state and Gmail history cursor", {
      stage: "finalizing",
      inserted: counts.inserted,
      updated: counts.updated,
      skipped: counts.skipped,
      deleted: counts.deleted,
      pending: 0,
    });

    await completeSyncRun(options.database, {
      accountId: options.account.id,
      runId,
      historyId: catchUp.nextHistoryId,
      counts,
    });
    return { syncType, counts, historyId: catchUp.nextHistoryId };
  } catch (error) {
    await failSyncRun(options.database, {
      accountId: options.account.id,
      runId,
      error,
      counts,
    });
    throw error;
  }
}

async function executeIncrementalSync(
  options: IngestionOptions,
): Promise<IngestionResult> {
  const counts = emptyCounts();
  const runId = await startSyncRun(
    options.database,
    options.account.id,
    "incremental",
  );

  try {
    const changes = await listIncrementalChanges(
      options.gmail,
      options.account.latest_history_id as string,
      options.requests,
    );
    counts.discovered = changes.changedMessageIds.length;
    await persistMessageIds(options, changes.changedMessageIds, counts);
    counts.deleted += await markMessagesDeleted(
      options.database,
      options.account.id,
      changes.deletedMessageIds,
    );

    await completeSyncRun(options.database, {
      accountId: options.account.id,
      runId,
      historyId: changes.nextHistoryId,
      counts,
    });
    return {
      syncType: "incremental",
      counts,
      historyId: changes.nextHistoryId,
    };
  } catch (error) {
    await failSyncRun(options.database, {
      accountId: options.account.id,
      runId,
      error,
      counts,
    });
    throw error;
  }
}

export async function runIngestion(
  options: IngestionOptions,
): Promise<IngestionResult> {
  if (options.forceFull) {
    if (options.resumeFull && options.account.latest_history_id) {
      options.onProgress?.(
        "Catching up from the last successful Gmail history cursor before resuming",
        { stage: "catching_up" },
      );
      try {
        await executeIncrementalSync(options);
      } catch (error) {
        if (!isExpiredHistoryError(error)) throw error;
        options.onProgress?.(
          "The previous Gmail history cursor expired; continuing with mailbox discovery",
        );
      }
    }
    return executeFullSync(options, "full");
  }

  if (!options.account.latest_history_id) {
    return executeFullSync(options, "full");
  }

  try {
    return await executeIncrementalSync(options);
  } catch (error) {
    if (!isExpiredHistoryError(error)) throw error;
    options.onProgress?.(
      "Gmail history cursor expired; starting a recovery full sync",
    );
    return executeFullSync(options, "recovery_full");
  }
}
