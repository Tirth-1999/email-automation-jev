import { google, type gmail_v1 } from "googleapis";

export interface GmailRequestRunner {
  run<T>(operation: string, request: () => Promise<T>): Promise<T>;
}

const directRequestRunner: GmailRequestRunner = {
  run: async <T>(_operation: string, request: () => Promise<T>) => request(),
};

export const GMAIL_READONLY_SCOPE =
  "https://www.googleapis.com/auth/gmail.readonly";

export function createGmailClient(options: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
}): gmail_v1.Gmail {
  const auth = new google.auth.OAuth2(
    options.clientId,
    options.clientSecret,
    options.redirectUri,
  );
  auth.setCredentials({ refresh_token: options.refreshToken });
  return google.gmail({ version: "v1", auth });
}

export async function getGmailProfile(
  gmail: gmail_v1.Gmail,
  requests: GmailRequestRunner = directRequestRunner,
) {
  const { data } = await requests.run("users.getProfile", () =>
    gmail.users.getProfile({ userId: "me" }),
  );
  if (!data.emailAddress || !data.historyId) {
    throw new Error("Gmail profile did not include emailAddress and historyId");
  }
  return {
    emailAddress: data.emailAddress.toLowerCase(),
    historyId: data.historyId,
    messagesTotal: data.messagesTotal ?? null,
  };
}

export interface FullSyncOptions {
  query: string;
  includeSpamTrash: boolean;
  maxMessages: number;
}

export async function* listFullSyncMessagePages(
  gmail: gmail_v1.Gmail,
  options: FullSyncOptions,
  requests: GmailRequestRunner = directRequestRunner,
): AsyncGenerator<string[]> {
  let pageToken: string | undefined;
  let remaining = options.maxMessages === 0
    ? Number.POSITIVE_INFINITY
    : options.maxMessages;

  do {
    const response = await requests.run("users.messages.list", () =>
      gmail.users.messages.list({
        userId: "me",
        includeSpamTrash: options.includeSpamTrash,
        maxResults: Math.min(500, remaining),
        ...(options.query ? { q: options.query } : {}),
        ...(pageToken ? { pageToken } : {}),
      }),
    );
    const ids = (response.data.messages || [])
      .map((message) => message.id)
      .filter((id): id is string => Boolean(id))
      .slice(0, remaining);

    if (ids.length > 0) yield ids;
    remaining -= ids.length;
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken && remaining > 0);
}

export interface IncrementalChanges {
  changedMessageIds: string[];
  deletedMessageIds: string[];
  nextHistoryId: string;
}

export async function listIncrementalChanges(
  gmail: gmail_v1.Gmail,
  startHistoryId: string,
  requests: GmailRequestRunner = directRequestRunner,
): Promise<IncrementalChanges> {
  const changed = new Set<string>();
  const deleted = new Set<string>();
  let pageToken: string | undefined;
  let nextHistoryId = startHistoryId;

  do {
    const response = await requests.run("users.history.list", () =>
      gmail.users.history.list({
        userId: "me",
        startHistoryId,
        maxResults: 500,
        ...(pageToken ? { pageToken } : {}),
      }),
    );

    for (const entry of response.data.history || []) {
      for (const item of entry.messagesAdded || []) {
        if (item.message?.id) changed.add(item.message.id);
      }
      for (const item of entry.labelsAdded || []) {
        if (item.message?.id) changed.add(item.message.id);
      }
      for (const item of entry.labelsRemoved || []) {
        if (item.message?.id) changed.add(item.message.id);
      }
      for (const item of entry.messagesDeleted || []) {
        if (item.message?.id) deleted.add(item.message.id);
      }
    }

    if (response.data.historyId) nextHistoryId = response.data.historyId;
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  for (const id of deleted) changed.delete(id);
  return {
    changedMessageIds: [...changed],
    deletedMessageIds: [...deleted],
    nextHistoryId,
  };
}

export async function fetchMessages(
  gmail: gmail_v1.Gmail,
  ids: string[],
  concurrency: number,
  requests: GmailRequestRunner = directRequestRunner,
): Promise<{ messages: gmail_v1.Schema$Message[]; missingIds: string[] }> {
  const results: gmail_v1.Schema$Message[] = [];
  const missingIds: string[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < ids.length) {
      const index = cursor;
      cursor += 1;
      const id = ids[index];
      if (!id) continue;
      try {
        const response = await requests.run("users.messages.get", () =>
          gmail.users.messages.get({
            userId: "me",
            id,
            format: "full",
          }),
        );
        results[index] = response.data;
      } catch (error) {
        if (isNotFoundError(error)) {
          missingIds.push(id);
          continue;
        }
        throw error;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, ids.length) }, () => worker()),
  );
  return { messages: results.filter(Boolean), missingIds };
}

export function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: number;
    response?: { status?: number };
  };
  return candidate.code === 404 || candidate.response?.status === 404;
}

export const isExpiredHistoryError = isNotFoundError;
