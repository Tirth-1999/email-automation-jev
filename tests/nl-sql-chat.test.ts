import assert from "node:assert/strict";
import test from "node:test";
import { aiChatSqlFailureMessage, answerSqlResultWithOpenAI, buildSqlGenerationInput, generateSqlWithOpenAI, isRepairableSqlExecutionError, repairSqlWithOpenAI, validateReadOnlySql, validateSqlForQuestion } from "../lib/nl-sql-chat.js";

test("NL-to-SQL accepts a scoped read over approved mailbox data", () => {
  const sql = "SELECT company, count(*) FROM applications WHERE gmail_account_id = :gmail_account_id GROUP BY company LIMIT 100";
  assert.equal(validateReadOnlySql(sql), sql);
  assert.equal(validateReadOnlySql(`${sql};`), sql);
});

test("NL-to-SQL rejects mutation, unscoped, multi-statement, and unknown-relation queries", () => {
  assert.throws(() => validateReadOnlySql("DELETE FROM applications WHERE gmail_account_id = :gmail_account_id"));
  assert.throws(() => validateReadOnlySql("SELECT * FROM applications LIMIT 10"));
  assert.throws(() => validateReadOnlySql("SELECT * FROM applications WHERE gmail_account_id = :gmail_account_id; DROP TABLE applications"));
  assert.throws(() => validateReadOnlySql("SELECT * FROM applications WHERE gmail_account_id = :gmail_account_id;;"));
  assert.throws(() => validateReadOnlySql("SELECT * FROM applications WHERE gmail_account_id = :gmail_account_id -- unsafe comment"));
  assert.throws(() => validateReadOnlySql("SELECT * FROM gmail_accounts WHERE id = :gmail_account_id"));
});

test("NL-to-SQL supports account-scoped CTEs over allowlisted relations", () => {
  const sql = "WITH active AS (SELECT * FROM applications WHERE gmail_account_id = :gmail_account_id) SELECT current_status, count(*) FROM active GROUP BY current_status";
  assert.equal(validateReadOnlySql(sql), sql);
});

test("NL-to-SQL receives application semantics and recent conversation memory", () => {
  const input = JSON.parse(buildSqlGenerationInput("How many of those were rejected?", [
    { role: "user", text: "Show my Verizon applications" },
    { role: "assistant", text: "I found the matching applications." },
  ])) as {
    reporting_model: string;
    recent_conversation: Array<{ role: string; text: string }>;
    latest_user_question: string;
    requested_answer_shape: string;
  };

  assert.match(input.reporting_model, /Canonical application read model/i);
  assert.match(input.reporting_model, /Do not join applications to application_board/i);
  assert.match(input.reporting_model, /current_status values: outreach, applied, reply_needed/i);
  assert.equal(input.recent_conversation[0]?.text, "Show my Verizon applications");
  assert.equal(input.latest_user_question, "How many of those were rejected?");
  assert.equal(input.requested_answer_shape, "summary");
});

test("role-list questions request detail evidence instead of an aggregate-only answer", async () => {
  let requestBody: Record<string, unknown> = {};
  const fetcher = async (_url: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
    return new Response(JSON.stringify({
      output_text: JSON.stringify({
        sql: "SELECT role, requisition_id, latest_subject, current_status FROM application_board WHERE gmail_account_id = :gmail_account_id AND company ILIKE '%Verizon%' LIMIT 100",
        explanation: "List the matching applications with fallback title evidence.",
      }),
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await generateSqlWithOpenAI("test", "gpt-4o-mini", "What all roles did we apply for at Verizon?", [], fetcher as typeof fetch);
  const input = JSON.parse(String(requestBody.input)) as { requested_answer_shape: string };
  assert.equal(input.requested_answer_shape, "list");
  assert.match(String(requestBody.instructions), /do not replace the requested values with only COUNT or GROUP BY/i);
  assert.match(String(requestBody.instructions), /select role, requisition_id, latest_subject, and current_status/i);
});

test("role-list semantic validation rejects grouped counts that hide missing roles", () => {
  const badSql = "SELECT role, COUNT(*) AS application_count FROM application_board WHERE gmail_account_id = :gmail_account_id AND company ILIKE '%Verizon%' GROUP BY role";
  const goodSql = "SELECT role, requisition_id, latest_subject, current_status FROM application_board WHERE gmail_account_id = :gmail_account_id AND company ILIKE '%Verizon%' LIMIT 100";
  assert.throws(
    () => validateSqlForQuestion("For what all roles did we apply?", badSql),
    /must include requisition_id|detail rows/i,
  );
  assert.equal(validateSqlForQuestion("For what all roles did we apply?", goodSql), goodSql);
});

test("schema-drift repair supplies the failed SQL and database error", async () => {
  let requestBody: Record<string, unknown> = {};
  const fetcher = async (_url: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
    return new Response(JSON.stringify({
      output_text: JSON.stringify({
        sql: "SELECT id, company FROM applications WHERE gmail_account_id = :gmail_account_id AND is_starred = true LIMIT 100",
        explanation: "Use the source relation that contains the star field.",
      }),
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await repairSqlWithOpenAI(
    "test",
    "gpt-4o-mini",
    "Show starred applications",
    [],
    "SELECT id, company FROM application_board WHERE gmail_account_id = :gmail_account_id AND is_starred = true",
    'column "is_starred" does not exist',
    fetcher as typeof fetch,
  );
  const input = JSON.parse(String(requestBody.input)) as { repair: { failed_sql: string; database_error: string } };
  assert.match(input.repair.failed_sql, /application_board/);
  assert.match(input.repair.database_error, /is_starred/);
  assert.match(String(requestBody.instructions), /previous query failed against the live database schema/i);
});

test("SQL execution errors distinguish repairable queries from missing infrastructure", () => {
  assert.equal(isRepairableSqlExecutionError({ code: "42703", message: 'column "is_starred" does not exist' }), true);
  assert.equal(isRepairableSqlExecutionError({ code: "42803", message: "grouping error" }), true);
  assert.equal(isRepairableSqlExecutionError({ code: "42501", message: "permission denied" }), false);
  assert.match(
    aiChatSqlFailureMessage({ code: "PGRST202", message: "Could not find execute_ai_readonly_sql" }),
    /Apply migration 011/i,
  );
  assert.doesNotMatch(
    aiChatSqlFailureMessage({ code: "PGRST204", message: "Could not find is_starred in the schema cache" }),
    /migration 011/i,
  );
});

test("large SQL results become a structured summary instead of a record dump", async () => {
  const rows = Array.from({ length: 100 }, (_, index) => ({ company: `Company ${index + 1}` }));
  const fetcher = async () => new Response(JSON.stringify({
    output_text: JSON.stringify({
      result_summary: "The returned applications span a broad set of companies.",
      direct_answer: "The result contains 100 matching application rows.",
      key_findings: ["The query returned the configured detail-row limit."],
      list_items: [],
    }),
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  const answer = await answerSqlResultWithOpenAI("test", "gpt-4o-mini", "Summarize them", "SELECT company FROM application_board", rows, fetcher as typeof fetch);
  assert.match(answer, /^Result summary/m);
  assert.match(answer, /^Answer$/m);
  assert.match(answer, /^Key findings$/m);
  assert.match(answer, /The SQL query returned 100 result rows/);
  assert.doesNotMatch(answer, /Company 100/);
});

test("explicit role lists are rendered as scannable result items", async () => {
  const rows = [{
    role: null,
    requisition_id: "R-1099229",
    latest_subject: "Update on your Verizon Application: Principal Engineer Data Engineering R-1099229 in Irvine, California",
  }];
  const fetcher = async () => new Response(JSON.stringify({
    output_text: JSON.stringify({
      result_summary: "One matching Verizon application was found.",
      direct_answer: "The application was for one identifiable role.",
      key_findings: [],
      list_items: ["Principal Engineer Data Engineering (R-1099229)"],
    }),
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  const answer = await answerSqlResultWithOpenAI("test", "gpt-4o-mini", "Which role?", "SELECT role, requisition_id, latest_subject FROM application_board", rows, fetcher as typeof fetch);
  assert.match(answer, /^Results$/m);
  assert.match(answer, /• Principal Engineer Data Engineering \(R-1099229\)/);
  assert.match(answer, /The SQL query returned 1 result row/);
});
