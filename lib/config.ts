import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function nonNegativeInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function positiveNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return parsed;
}

function booleanValue(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${name} must be true or false`);
}

export function loadOAuthConfig() {
  return {
    clientId: required("GMAIL_CLIENT_ID"),
    clientSecret: required("GMAIL_CLIENT_SECRET"),
    redirectUri:
      process.env.GMAIL_REDIRECT_URI?.trim() ||
      "http://localhost:3000/oauth2callback",
  };
}

export async function loadRefreshToken(): Promise<string> {
  const environmentToken = process.env.GMAIL_REFRESH_TOKEN?.trim();
  if (environmentToken) return environmentToken;

  const tokenPath = resolve(process.cwd(), ".gmail-token.json");
  try {
    const tokenFile = JSON.parse(await readFile(tokenPath, "utf8")) as {
      refresh_token?: string;
    };
    if (tokenFile.refresh_token?.trim()) return tokenFile.refresh_token.trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error(`Could not read ${tokenPath}: ${(error as Error).message}`);
    }
  }

  throw new Error(
    "No Gmail refresh token found. Run `npm run gmail:auth` or set GMAIL_REFRESH_TOKEN.",
  );
}

export async function loadIngestionConfig() {
  return {
    supabaseUrl: required("SUPABASE_URL"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    oauth: loadOAuthConfig(),
    refreshToken: await loadRefreshToken(),
    gmailQuery: process.env.GMAIL_QUERY?.trim() || "-in:drafts",
    includeSpamTrash: booleanValue("GMAIL_INCLUDE_SPAM_TRASH", true),
    includeOutgoing: booleanValue("GMAIL_INCLUDE_OUTGOING", true),
    maxMessages: nonNegativeInteger("GMAIL_MAX_MESSAGES", 0),
    fetchConcurrency: positiveInteger("GMAIL_FETCH_CONCURRENCY", 2),
    requestsPerSecond: positiveNumber("GMAIL_REQUESTS_PER_SECOND", 2),
    maxRetries: nonNegativeInteger("GMAIL_MAX_RETRIES", 8),
    upsertBatchSize: positiveInteger("GMAIL_UPSERT_BATCH_SIZE", 100),
  };
}
