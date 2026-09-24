import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { buildApplicationBoardSnapshot } from "../lib/application-board-cache.js";

test("application board snapshot materializes status and starred lanes", () => {
  const snapshot = buildApplicationBoardSnapshot(
    [
      { id: "a", current_status: "offer", last_activity_at: "2026-09-22T00:00:00Z" },
      { id: "b", current_status: "applied", last_activity_at: "2026-09-21T00:00:00Z" },
    ],
    [
      { id: "a", is_starred: true, starred_at: "2026-09-23T00:00:00Z" },
      { id: "b", is_starred: false, starred_at: null },
    ],
    "2026-09-23T12:00:00Z",
  );

  assert.equal(snapshot.by_status.offer?.length, 1);
  assert.equal(snapshot.by_status.applied?.length, 1);
  assert.deepEqual(snapshot.starred.map((row) => row.id), ["a"]);
});

test("loading more applications preserves each lane scroll position", async () => {
  const [browser, server] = await Promise.all([
    readFile(resolve(process.cwd(), "apps/dashboard/src/app.js"), "utf8"),
    readFile(resolve(process.cwd(), "apps/server/index.ts"), "utf8"),
  ]);
  assert.match(browser, /laneScrollPositions/);
  assert.match(browser, /data-application-lane/);
  assert.match(browser, /cards\.scrollTop = Number\(laneScrollPositions\.get\(status\)/);
  assert.match(browser, /applicationBoard\.scrollLeft = boardScrollLeft/);
  assert.match(browser, /"Load 30 more"/);
  assert.match(browser, /application-board:view-state:v1/);
  assert.match(browser, /loadedCounts\[status\]/);
  assert.match(browser, /laneScrollTop\[status\]/);
  assert.match(server, /Math\.min\(5_000/);
});
