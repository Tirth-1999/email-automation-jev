import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

test("interview progress is private to the Interview Assessment lane", async () => {
  const [migration, browser, styles, server] = await Promise.all([
    readFile(resolve(process.cwd(), "supabase/migrations/020_interview_progress.sql"), "utf8"),
    readFile(resolve(process.cwd(), "apps/dashboard/src/app.js"), "utf8"),
    readFile(resolve(process.cwd(), "apps/dashboard/src/styles.css"), "utf8"),
    readFile(resolve(process.cwd(), "apps/server/index.ts"), "utf8"),
  ]);

  assert.match(migration, /interview_progress in \('pending', 'completed'\)/);
  assert.match(migration, /current_status = 'interview_assessment'/);
  assert.match(migration, /set_application_interview_progress/);
  assert.match(migration, /application\.interview_progress/);
  assert.match(browser, /laneStatus === "interview_assessment"/);
  assert.match(browser, /Interview completed/);
  assert.match(browser, /\/api\/applications\/interview-progress/);
  assert.match(styles, /\.interview-progress-completed/);
  assert.match(styles, /\.interview-progress-pending/);
  assert.match(server, /set_application_interview_progress/);
});
