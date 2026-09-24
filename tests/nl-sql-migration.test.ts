import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/011_nl_sql_chat.sql", import.meta.url);
const applicationBoardRefreshPath = new URL("../supabase/migrations/019_refresh_application_board_view.sql", import.meta.url);

test("NL-to-SQL migration exposes only a bounded service-role read function", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /create or replace function public\.execute_ai_readonly_sql/i);
  assert.match(sql, /language plpgsql\s+stable/i);
  assert.match(sql, /statement_timeout/i);
  assert.match(sql, /limit 200/i);
  assert.match(sql, /revoke all .* from public, anon, authenticated/i);
  assert.match(sql, /grant execute .* to service_role/i);
});

test("application board refresh exposes star fields added after the original view", async () => {
  const sql = await readFile(applicationBoardRefreshPath, "utf8");
  assert.match(sql, /create or replace view public\.application_board/i);
  assert.match(sql, /application\.is_starred/i);
  assert.match(sql, /application\.starred_at/i);
  assert.match(sql, /with \(security_invoker = true\)/i);
  assert.match(sql, /grant select on public\.application_board to service_role/i);
});
