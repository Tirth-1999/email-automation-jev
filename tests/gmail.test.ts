import assert from "node:assert/strict";
import test from "node:test";
import type { gmail_v1 } from "googleapis";
import {
  listFullSyncMessagePages,
  listIncrementalChanges,
} from "../lib/gmail.js";

test("full sync follows Gmail page tokens and respects the message limit", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const gmail = {
    users: {
      messages: {
        list: async (parameters: Record<string, unknown>) => {
          calls.push(parameters);
          if (!parameters.pageToken) {
            return {
              data: {
                messages: [{ id: "one" }, { id: "two" }],
                nextPageToken: "next-page",
              },
            };
          }
          return {
            data: { messages: [{ id: "three" }, { id: "four" }] },
          };
        },
      },
    },
  } as unknown as gmail_v1.Gmail;

  const pages: string[][] = [];
  for await (const page of listFullSyncMessagePages(gmail, {
    query: "-in:sent",
    includeSpamTrash: false,
    maxMessages: 3,
  })) {
    pages.push(page);
  }

  assert.deepEqual(pages, [["one", "two"], ["three"]]);
  assert.equal(calls.length, 2);
  assert.equal(calls[1]?.pageToken, "next-page");
});

test("a zero full-sync limit imports every available page", async () => {
  let page = 0;
  const gmail = {
    users: {
      messages: {
        list: async () => {
          page += 1;
          return page === 1
            ? {
                data: {
                  messages: [{ id: "one" }, { id: "two" }],
                  nextPageToken: "next-page",
                },
              }
            : { data: { messages: [{ id: "three" }, { id: "four" }] } };
        },
      },
    },
  } as unknown as gmail_v1.Gmail;

  const ids: string[] = [];
  for await (const pageIds of listFullSyncMessagePages(gmail, {
    query: "-in:drafts",
    includeSpamTrash: true,
    maxMessages: 0,
  })) {
    ids.push(...pageIds);
  }

  assert.deepEqual(ids, ["one", "two", "three", "four"]);
});

test("incremental sync deduplicates changes and lets deletion win", async () => {
  let page = 0;
  const gmail = {
    users: {
      history: {
        list: async () => {
          page += 1;
          if (page === 1) {
            return {
              data: {
                history: [
                  {
                    messagesAdded: [{ message: { id: "new-message" } }],
                    labelsAdded: [{ message: { id: "relabeled-message" } }],
                  },
                ],
                historyId: "101",
                nextPageToken: "next-page",
              },
            };
          }
          return {
            data: {
              history: [
                {
                  messagesAdded: [{ message: { id: "new-message" } }],
                  messagesDeleted: [{ message: { id: "relabeled-message" } }],
                },
              ],
              historyId: "102",
            },
          };
        },
      },
    },
  } as unknown as gmail_v1.Gmail;

  const changes = await listIncrementalChanges(gmail, "100");
  assert.deepEqual(changes.changedMessageIds, ["new-message"]);
  assert.deepEqual(changes.deletedMessageIds, ["relabeled-message"]);
  assert.equal(changes.nextHistoryId, "102");
});
