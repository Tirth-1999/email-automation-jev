import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/011_nl_sql_chat.sql", import.meta.url);

test("NL-to-SQL migration exposes only a bounded service-role read function", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /create or replace function public\.execute_ai_readonly_sql/i);
  assert.match(sql, /language plpgsql\s+stable/i);
  assert.match(sql, /statement_timeout/i);
  assert.match(sql, /limit 200/i);
  assert.match(sql, /revoke all .* from public, anon, authenticated/i);
  assert.match(sql, /grant execute .* to service_role/i);
});
