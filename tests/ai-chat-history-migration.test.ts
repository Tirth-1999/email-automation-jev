import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/013_ai_chat_history.sql", import.meta.url);

test("AI Chat history uses one private archival table", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /create table public\.ai_chat_conversations/i);
  assert.match(sql, /messages jsonb not null default '\[\]'::jsonb/i);
  assert.doesNotMatch(sql, /create table public\.ai_chat_messages/i);
  assert.match(sql, /archived_at timestamptz/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all .* from public, anon, authenticated/i);
  assert.match(sql, /grant all .* to service_role/i);
});
