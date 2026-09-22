import { loadIngestionConfig } from "../lib/config.js";
import { createGmailClient, getGmailProfile } from "../lib/gmail.js";
import { GmailRequestController } from "../lib/gmail-rate-limit.js";
import { TerminalIngestionStats } from "../lib/terminal-stats.js";
import { runIngestion } from "../lib/ingest.js";
import {
  createDatabaseClient,
  ensureGmailAccount,
} from "../lib/repository.js";

const progress = new TerminalIngestionStats();

function readLimitOverride(): number | undefined {
  const argument = process.argv.find((value) => value.startsWith("--limit="));
  if (!argument) return undefined;
  const value = Number.parseInt(argument.slice("--limit=".length), 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("--limit must be a positive integer, for example --limit=100");
  }
  return value;
}

async function main(): Promise<void> {
  const config = await loadIngestionConfig();
  const limitOverride = readLimitOverride();
  const forceFull = process.argv.includes("--full");
  const resumeFull = process.argv.includes("--resume");
  if (resumeFull && !forceFull) {
    throw new Error("--resume must be used with --full");
  }
  const gmail = createGmailClient({ ...config.oauth, refreshToken: config.refreshToken });
  const requests = new GmailRequestController({
    requestsPerSecond: config.requestsPerSecond,
    maxRetries: config.maxRetries,
    onRetry: ({ operation, attempt, maxRetries, delayMs, reason }) => {
      progress.retry(
        `Gmail throttled ${operation}; retry ${attempt}/${maxRetries} in ${Math.ceil(delayMs / 1_000)}s: ${reason}`,
      );
    },
  });
  const database = createDatabaseClient(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
  );

  progress.update("Reading Gmail profile...");
  const profile = await getGmailProfile(gmail, requests);
  const account = await ensureGmailAccount(database, profile.emailAddress);
  progress.setMailboxTotal(profile.messagesTotal);
  progress.update(`Connected account: ${profile.emailAddress}`);

  const result = await runIngestion({
    database,
    gmail,
    requests,
    account,
    profileHistoryId: profile.historyId,
    forceFull,
    resumeFull,
    query: config.gmailQuery,
    includeSpamTrash: config.includeSpamTrash,
    includeOutgoing: config.includeOutgoing,
    maxMessages: limitOverride || config.maxMessages,
    fetchConcurrency: config.fetchConcurrency,
    upsertBatchSize: config.upsertBatchSize,
    onProgress: (message, stats) => progress.update(message, stats),
  });

  progress.complete();
  console.log("\nSync complete");
  console.table({
    type: result.syncType,
    discovered: result.counts.discovered,
    inserted: result.counts.inserted,
    updated: result.counts.updated,
    deleted: result.counts.deleted,
    skipped: result.counts.skipped,
    historyId: result.historyId,
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  progress.fail(`Ingestion failed: ${message}`);
  process.exitCode = 1;
});
