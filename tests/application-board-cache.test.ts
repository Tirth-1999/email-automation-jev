import assert from "node:assert/strict";
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
