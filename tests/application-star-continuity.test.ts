import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { applicationStarState } from "../lib/application-materializer.js";

test("a star follows its anchor email into a newly regrouped application", () => {
  const anchors = new Map([
    ["corrected-email", "2026-09-23T12:00:00.000Z"],
  ]);
  assert.deepEqual(applicationStarState(["other-email"], anchors), {
    is_starred: false,
    starred_at: null,
  });
  assert.deepEqual(applicationStarState(["new-email", "corrected-email"], anchors), {
    is_starred: true,
    starred_at: "2026-09-23T12:00:00.000Z",
  });
});

test("migration 016 anchors stars without adding another table", async () => {
  const migration = await readFile(
    resolve(process.cwd(), "supabase/migrations/016_durable_application_stars.sql"),
    "utf8",
  );
  assert.match(migration, /add column if not exists application_starred_at/);
  assert.match(migration, /create or replace function public\.set_application_star/);
  assert.match(migration, /order by email\.internal_date desc/);
  assert.doesNotMatch(migration, /create table/i);
  assert.match(migration, /grant execute[\s\S]*to service_role/);
});
