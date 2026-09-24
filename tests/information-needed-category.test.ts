import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { APPLICATION_STATUSES } from "../lib/application-grouping.js";
import { CLASSIFIER_VERSION, EMAIL_CATEGORY_CRITERIA, JEV_CATEGORIES } from "../lib/jev-classifier.js";
import { LLM_REVIEW_CATEGORIES, shouldRequestLlmReview } from "../lib/llm-reviewer.js";

test("information needed is a first-class v6 category across decision contracts", () => {
  assert.equal(CLASSIFIER_VERSION, "job-email-jev-v6");
  assert.ok(JEV_CATEGORIES.includes("information_needed"));
  assert.ok(APPLICATION_STATUSES.includes("information_needed"));
  assert.ok(LLM_REVIEW_CATEGORIES.includes("information_needed"));
  assert.equal(shouldRequestLlmReview("information_needed", 0.99), true);
});

test("information forms are explicitly separated from candidate evaluations", () => {
  const information = JSON.stringify(EMAIL_CATEGORY_CRITERIA.information_needed);
  const assessment = JSON.stringify(EMAIL_CATEGORY_CRITERIA.interview_assessment);
  const other = JSON.stringify(EMAIL_CATEGORY_CRITERIA.other);
  assert.match(information, /EEO/i);
  assert.match(information, /WOTC/i);
  assert.match(information, /administrative/i);
  assert.match(assessment, /evaluat/i);
  assert.match(assessment, /administrative information forms/i);
  assert.match(information, /candidate-experience/i);
  assert.match(information, /belongs to other/i);
  assert.match(assessment, /feedback survey/i);
  assert.match(other, /interview-process feedback/i);
});

test("migration 014 widens existing constraints without adding a table", async () => {
  const migration = await readFile(
    resolve(process.cwd(), "supabase/migrations/014_information_needed_category.sql"),
    "utf8",
  );
  assert.match(migration, /information_needed/);
  assert.match(migration, /alter table public\.email_classifications/);
  assert.match(migration, /alter table public\.applications/);
  assert.doesNotMatch(migration, /create table/i);
  assert.match(migration, /notify pgrst, 'reload schema'/);
});
