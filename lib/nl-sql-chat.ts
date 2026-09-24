export interface GeneratedSql {
  sql: string;
  explanation: string;
}

export interface NlSqlAnswer {
  answer: string;
  sql: string;
  rowCount: number;
  rows: Array<Record<string, unknown>>;
  model: string;
}

type RequestedAnswerShape = "list" | "summary";

function requestedAnswerShape(question: string): RequestedAnswerShape {
  return /\b(?:which|what\s+all|list|show|name)\b|\bwhat\s+(?:roles?|positions?|jobs?|companies|applications?|emails?)\b/i.test(question)
    ? "list"
    : "summary";
}

const ALLOWED_RELATIONS = new Set([
  "applications",
  "application_board",
  "application_messages",
  "application_status_events",
  "email_board",
  "classification_runs",
]);

const SCHEMA = `
REPORTING MODEL

application_board
- Canonical application read model: exactly one row per grouped job application/opportunity.
- Use this relation directly for application lists, counts, companies, roles, statuses, recency, action counts, and latest-email summaries.
- Columns: id, gmail_account_id, grouping_key, company, role, requisition_id, current_status, first_activity_at, last_activity_at, ghosted_at, grouping_source, manual_notes, created_at, updated_at, is_starred, starred_at, message_count, event_count, actionable_count, latest_email_id, latest_subject, latest_sender, latest_next_action, latest_confidence.
- Do not join applications to application_board: application_board already contains the application columns.

applications
- Writable source behind application_board. Use only when a requested field is absent from application_board.
- Columns: id, gmail_account_id, grouping_key, company, role, requisition_id, current_status, first_activity_at, last_activity_at, ghosted_at, grouping_source, manual_notes, created_at, updated_at, is_starred, starred_at.

application_messages
- Bridge assigning each email to one application.
- Columns: application_id, email_id, association_source, association_confidence, created_at.
- It has no gmail_account_id. Scope it by joining application_messages.application_id to application_board.id and filtering application_board.gmail_account_id.

application_status_events
- Application lifecycle history; one row per observed status event, not one row per application.
- Columns: id, application_id, email_id, status, event_at, source, explanation, created_at.
- It has no gmail_account_id. Scope it through application_board.

email_board
- Canonical classified-email read model: exactly one row per email decision. Use it for email counts and email-level details.
- Columns: email_id, gmail_account_id, gmail_message_id, gmail_thread_id, internal_date, direction, from_name, from_email, subject, snippet, effective_category, next_action, urgency_level, should_draft, category_confidence, category_top_probability, human_category.

classification_runs
- One row per Jev classification run. Use it only for processing/run performance questions.
- Columns: id, gmail_account_id, status, run_kind, model_requested, total_count, processed_count, succeeded_count, failed_count, uncertain_count, started_at, finished_at, created_at.

ENUMS AND MEANINGS
- Application current_status values: outreach, applied, reply_needed, information_needed, interview_assessment, offer, rejected, ghosted.
- Email effective_category uses the same job categories and may also contain other.
- direction values distinguish incoming and outgoing email.
- is_starred is a separate user flag and does not replace current_status.

QUERY RECIPES
- Application count/list/status/company/role question: query application_board only and filter application_board.gmail_account_id = :gmail_account_id.
- Email count/list/sender/subject question: query email_board only and filter email_board.gmail_account_id = :gmail_account_id.
- Lifecycle history: join application_status_events to application_board on application_id = id, then scope through application_board.gmail_account_id.
- Company or role lookup: use ILIKE with surrounding percent wildcards unless the user explicitly asks for an exact match.
`.trim();

export function buildSqlGenerationInput(
  question: string,
  history: Array<{ role: "user" | "assistant"; text: string }> = [],
): string {
  return JSON.stringify({
    reporting_model: SCHEMA,
    recent_conversation: history.slice(-6).map((message) => ({
      role: message.role,
      text: message.text.slice(0, 1_000),
    })),
    latest_user_question: question.slice(0, 2_000),
    requested_answer_shape: requestedAnswerShape(question),
  });
}

function responseText(payload: { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }): string {
  if (typeof payload.output_text === "string") return payload.output_text;
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("");
}

export function validateReadOnlySql(sqlValue: string): string {
  const sql = sqlValue.trim();
  if (!sql || sql.length > 5_000) throw new Error("Generated SQL is empty or too long");
  if (!/^(?:select|with)\b/i.test(sql)) throw new Error("AI Chat permits only SELECT queries");
  if (sql.includes(";") || /--|\/\*/.test(sql)) throw new Error("SQL comments and multiple statements are not allowed");
  if (!sql.includes(":gmail_account_id")) throw new Error("Generated SQL must include the account scope placeholder");
  if (/\b(?:insert|update|delete|merge|alter|drop|create|truncate|grant|revoke|copy|execute|call|do|vacuum|analyze|refresh|set|reset|listen|notify)\b/i.test(sql)) {
    throw new Error("Generated SQL contains a forbidden operation");
  }
  if (/\b(?:pg_catalog|information_schema|auth|storage|vault|pg_read_file|dblink|current_setting|set_config)\b/i.test(sql)) {
    throw new Error("Generated SQL references a forbidden schema or function");
  }
  const cteNames = new Set([...sql.matchAll(/(?:\bwith|,)\s*([a-z_][a-z0-9_]*)\s+as\s*\(/gi)].map((match) => match[1]?.toLowerCase() || ""));
  const relations = [...sql.matchAll(/\b(?:from|join)\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi)].map((match) => match[1]?.toLowerCase() || "");
  if (!relations.length || relations.some((relation) => !ALLOWED_RELATIONS.has(relation) && !cteNames.has(relation))) {
    throw new Error("Generated SQL references a relation outside the AI Chat allowlist");
  }
  return sql;
}

export function validateSqlForQuestion(question: string, sqlValue: string): string {
  const sql = validateReadOnlySql(sqlValue);
  const asksForRoleList = requestedAnswerShape(question) === "list"
    && /\b(?:roles?|positions?|job\s+titles?)\b/i.test(question)
    && !/\b(?:count|how\s+many|number\s+of)\b/i.test(question);
  if (!asksForRoleList) return sql;
  if (!/\bfrom\s+(?:public\.)?application_board\b/i.test(sql)) {
    throw new Error("Role-list questions must query application_board");
  }
  for (const field of ["role", "requisition_id", "latest_subject", "current_status"]) {
    if (!new RegExp(`\\b${field}\\b`, "i").test(sql)) {
      throw new Error(`Role-list queries must include ${field}`);
    }
  }
  if (/\bcount\s*\(|\bgroup\s+by\b/i.test(sql)) {
    throw new Error("Role-list questions require application detail rows, not grouped counts");
  }
  return sql;
}

export async function generateSqlWithOpenAI(
  apiKey: string,
  model: string,
  question: string,
  history: Array<{ role: "user" | "assistant"; text: string }> = [],
  fetcher: typeof fetch = fetch,
): Promise<GeneratedSql> {
  const response = await fetcher("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      instructions: [
        "Convert the user's job-search mailbox question into one PostgreSQL read-only query.",
        "Use only the supplied schema. Never invent a relation or column.",
        "Every query must be scoped to one Gmail account with the literal placeholder :gmail_account_id.",
        "Treat application_board as the canonical application reporting relation. Never join it to applications.",
        "Use ILIKE with surrounding percent wildcards for company/title matching. Prefer application_board for application questions and email_board for email questions.",
        "For totals, comparisons, distributions, or trends, prefer SQL aggregation with count, group by, date_trunc, min, or max so the result describes the full scoped dataset instead of an arbitrary detail-row slice.",
        "For which/what/list/show/name questions, return the matching detail records needed to enumerate the answer; do not replace the requested values with only COUNT or GROUP BY output.",
        "For a role-list question, select role, requisition_id, latest_subject, and current_status from application_board. Role is nullable, so latest_subject is required as supporting evidence when the normalized role is missing.",
        "Use recent conversation only to resolve references in the latest question; the latest question remains authoritative.",
        "Do not return email bodies. Return at most 100 detail rows. Do not use SQL comments or a semicolon.",
      ].join(" "),
      input: buildSqlGenerationInput(question, history),
      max_output_tokens: 700,
      text: {
        format: {
          type: "json_schema",
          name: "mailbox_sql_query",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              sql: { type: "string" },
              explanation: { type: "string" },
            },
            required: ["sql", "explanation"],
          },
        },
      },
    }),
  });
  const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || `SQL generation failed with status ${response.status}`);
  const output = responseText(payload);
  if (!output) throw new Error("OpenAI returned no SQL");
  const parsed = JSON.parse(output) as GeneratedSql;
  return { sql: validateSqlForQuestion(question, parsed.sql), explanation: String(parsed.explanation || "") };
}

export async function answerSqlResultWithOpenAI(
  apiKey: string,
  model: string,
  question: string,
  sql: string,
  rows: Array<Record<string, unknown>>,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const response = await fetcher("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      instructions: [
        "You are the analytical response layer for a job-search command center.",
        "Use only the supplied SQL result; never invent facts or silently treat a limited result set as the complete database.",
        "First synthesize the result set into a concise summary, then give a direct answer to the user's question.",
        "Extract the most useful counts, distributions, patterns, extremes, or next actions as at most five short key findings.",
        "When many detail rows are returned, summarize them instead of listing every record. When the user asks which/what/list/show/name, put each requested value in list_items when 25 or fewer records are returned.",
        "For role lists, prefer the normalized role column. If it is blank, you may extract a title only when latest_subject states it clearly; preserve that wording and include the requisition ID when present. Otherwise label the role as unknown instead of inventing it.",
        "If result_row_count is zero, clearly say that no matching records were found. If it is greater than zero, never claim that no records were found.",
        "Keep company names, role names, dates, statuses, and counts exactly grounded in the rows.",
      ].join(" "),
      input: JSON.stringify({ question, sql, result_row_count: rows.length, rows }),
      max_output_tokens: 700,
      text: {
        format: {
          type: "json_schema",
          name: "mailbox_sql_answer",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              result_summary: { type: "string" },
              direct_answer: { type: "string" },
              key_findings: { type: "array", items: { type: "string" }, maxItems: 5 },
              list_items: { type: "array", items: { type: "string" }, maxItems: 25 },
            },
            required: ["result_summary", "direct_answer", "key_findings", "list_items"],
          },
        },
      },
    }),
  });
  const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || `Answer generation failed with status ${response.status}`);
  const output = responseText(payload).trim();
  if (!output) throw new Error("OpenAI returned no answer");
  const parsed = JSON.parse(output) as { result_summary: string; direct_answer: string; key_findings: string[]; list_items: string[] };
  const sections = [
    "Result summary",
    String(parsed.result_summary || "").trim(),
    "",
    "Answer",
    String(parsed.direct_answer || "").trim(),
  ];
  const items = Array.isArray(parsed.list_items) ? parsed.list_items.map(String).filter(Boolean).slice(0, 25) : [];
  if (items.length) sections.push("", "Results", ...items.map((item) => `• ${item}`));
  const findings = Array.isArray(parsed.key_findings) ? parsed.key_findings.map(String).filter(Boolean).slice(0, 5) : [];
  if (findings.length) sections.push("", "Key findings", ...findings.map((finding) => `• ${finding}`));
  sections.push("", "Coverage", rows.length === 1 ? "The SQL query returned 1 result row." : `The SQL query returned ${rows.length} result rows.`);
  return sections.join("\n");
}

export async function answerConversationWithOpenAI(
  apiKey: string,
  model: string,
  question: string,
  history: Array<{ role: "user" | "assistant"; text: string }>,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const response = await fetcher("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      instructions: [
        "You are the concise conversational interface for a read-only job-search mailbox application.",
        "This route has no database result, so do not state mailbox counts, companies, statuses, or other user-specific facts.",
        "You may greet the user, explain that you can answer questions about applications and classified emails, or clarify how to ask a question.",
      ].join(" "),
      input: JSON.stringify({ history: history.slice(-6), latest_user_message: question }),
      max_output_tokens: 300,
    }),
  });
  const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || `Conversation response failed with status ${response.status}`);
  const answer = responseText(payload).trim();
  if (!answer) throw new Error("OpenAI returned no conversational answer");
  return answer;
}
