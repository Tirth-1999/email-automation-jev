import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("application publication preserves promoted company and title identities", async () => {
  const source = await readFile(new URL("../lib/application-materializer.ts", import.meta.url), "utf8");
  assert.match(source, /application_company_resolutions/);
  assert.match(source, /promoted_company_at/);
  assert.match(source, /promoted_title_at/);
  assert.match(source, /promotedCompany \|\| candidate\.company/);
  assert.match(source, /promotedTitle \|\| candidate\.role/);
  assert.doesNotMatch(source, /\.in\("application_id", existingIds/);
  assert.match(source, /readAllRows<Record<string, unknown>>/);
});
