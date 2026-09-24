import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/010_company_resolution_staging.sql", import.meta.url);

test("company resolution migration is private staging and leaves applications untouched", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /create table public\.application_company_resolutions/i);
  assert.match(sql, /employer_probabilities jsonb/i);
  assert.match(sql, /title_candidate_set jsonb/i);
  assert.match(sql, /title_probabilities jsonb/i);
  assert.match(sql, /company_needs_llm_review boolean/i);
  assert.match(sql, /title_needs_llm_review boolean/i);
  assert.match(sql, /agency_probabilities jsonb/i);
  assert.match(sql, /platform_probabilities jsonb/i);
  assert.match(sql, /needs_llm_review boolean/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all .* from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /update public\.applications/i);
  assert.doesNotMatch(sql, /alter table public\.applications/i);
});
