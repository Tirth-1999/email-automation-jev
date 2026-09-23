import assert from "node:assert/strict";
import test from "node:test";
import { createSnapshotCache } from "../lib/snapshot-cache.js";

test("snapshot cache works without Redis", async () => {
  const cache = createSnapshotCache();
  await cache.set("analytics:30", { count: 4 }, 60);
  assert.deepEqual(await cache.get("analytics:30"), { count: 4 });
  assert.equal(cache.backend(), "memory");
  await cache.delete(["analytics:30"]);
  assert.equal(await cache.get("analytics:30"), null);
});
