import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/012_promote_company_resolution.sql", import.meta.url);

test("company promotion requires both confidence and probability above the gate and preserves old values", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /previous_company text/i);
  assert.match(sql, /previous_role text/i);
  assert.match(sql, /employer_confidence > p_minimum_score/i);
  assert.match(sql, /employer_top_probability > p_minimum_score/i);
  assert.match(sql, /title_confidence > p_minimum_score/i);
  assert.match(sql, /title_top_probability > p_minimum_score/i);
  assert.match(sql, /revoke all .* from public, anon, authenticated/i);
});
