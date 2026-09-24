import type { SupabaseClient } from "@supabase/supabase-js";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import {
  buildApplicationCandidates,
  type ApplicationEmailEvidence,
} from "./application-grouping.js";
import {
  evaluateApplicationRelationships,
  type ApplicationRelationshipEvaluation,
} from "./application-relationship.js";

const PAGE_SIZE = 1_000;
const WRITE_BATCH_SIZE = 500;

export interface ApplicationMaterializationResult {
  classified_email_count: number;
  application_count: number;
  message_count: number;
  event_count: number;
  status_counts: Record<string, number>;
  relationship_checks: number;
  relationship_matches: number;
  relationship_failures: number;
  relationship_input_tokens: number;
}

export interface ApplicationStarState {
  is_starred: boolean;
  starred_at: string | null;
}

export function applicationStarState(
  emailIds: string[],
  anchors: ReadonlyMap<string, string>,
): ApplicationStarState {
  const timestamps = emailIds
    .map((emailId) => anchors.get(emailId))
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left));
  return {
    is_starred: timestamps.length > 0,
    starred_at: timestamps[0] || null,
  };
}

async function readEvidence(database: SupabaseClient): Promise<ApplicationEmailEvidence[]> {
  const rows: ApplicationEmailEvidence[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await database
      .from("email_board")
      .select("email_id,gmail_account_id,gmail_thread_id,internal_date,direction,from_name,from_email,subject,snippet,effective_category,human_category")
      .not("effective_category", "is", null)
      .order("email_id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not load classified email evidence: ${error.message}`);
    const page = (data || []) as ApplicationEmailEvidence[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function readAllRows<T>(
  database: SupabaseClient,
  table: string,
  columns: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await database
      .from(table)
      .select(columns)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not load ${table}: ${error.message}`);
    const page = (data || []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export function unlinkedDeterministicApplicationIds(
  applications: Array<{ id: string; grouping_source: string }>,
  links: Array<{ application_id: string }>,
): string[] {
  const linkedIds = new Set(links.map((link) => link.application_id));
  return applications
    .filter((application) => application.grouping_source === "deterministic")
    .filter((application) => !linkedIds.has(application.id))
    .map((application) => application.id);
}

async function deleteInBatches(
  database: SupabaseClient,
  table: string,
  column: string,
  values: string[],
  extraFilter?: (query: any) => any,
): Promise<void> {
  for (let offset = 0; offset < values.length; offset += WRITE_BATCH_SIZE) {
    let query = database.from(table).delete().in(column, values.slice(offset, offset + WRITE_BATCH_SIZE));
    if (extraFilter) query = extraFilter(query);
    const { error } = await query;
    if (error) throw new Error(`Could not refresh ${table}: ${error.message}`);
  }
}

export async function materializeApplications(
  database: SupabaseClient,
  options: {
    ghostAfterDays?: number;
    onProgress?: (progress: { stage: string; percent: number }) => void;
    relationshipEvaluator?: (rows: ApplicationEmailEvidence[]) => Promise<ApplicationRelationshipEvaluation>;
  } = {},
): Promise<ApplicationMaterializationResult> {
  options.onProgress?.({ stage: "loading_classifications", percent: 10 });
  const evidence = await readEvidence(database);
  const { data: manualLinks, error: manualLinksError } = await database
    .from("application_messages")
    .select("email_id")
    .eq("association_source", "manual");
  if (manualLinksError) throw new Error(`Could not load manual application links: ${manualLinksError.message}`);
  const manuallyAssignedEmailIds = new Set(
    (manualLinks || []).map((link) => String(link.email_id)),
  );
  const deterministicEvidence = evidence.filter(
    (email) => !manuallyAssignedEmailIds.has(email.email_id),
  );
  options.onProgress?.({ stage: "checking_thread_relationships", percent: 22 });
  let relationshipEvaluation: ApplicationRelationshipEvaluation = {
    decisions: new Map(),
    checkedCount: 0,
    matchedCount: 0,
    failedCount: 0,
    inputTokens: 0,
  };
  if (options.relationshipEvaluator) {
    relationshipEvaluation = await options.relationshipEvaluator(deterministicEvidence);
  } else if (process.env.TYPESAFE_API_KEY?.trim()) {
    const model = process.env.TYPESAFE_MODEL?.trim() || "jev-1.13.0";
    const client = new TypeSafeClient({
      defaultModel: model,
      timeout: 30_000,
      retry: { maxRetries: 2 },
    });
    relationshipEvaluation = await evaluateApplicationRelationships(client, deterministicEvidence, {
      model,
      sameThreshold: Number(process.env.JEV_APPLICATION_MATCH_THRESHOLD || "0.72"),
      concurrency: Number(process.env.JEV_APPLICATION_MATCH_CONCURRENCY || "8"),
      maxPairsPerThread: Number(process.env.JEV_APPLICATION_MAX_PAIRS_PER_THREAD || "24"),
    });
  }
  options.onProgress?.({ stage: "grouping_applications", percent: 30 });
  const candidates = buildApplicationCandidates(deterministicEvidence, {
    ghostAfterDays: options.ghostAfterDays ?? Number(process.env.APPLICATION_GHOST_DAYS || "21"),
    relationshipDecisions: relationshipEvaluation.decisions,
    ambiguousThreadFallback: "different",
  });

  const { data: existing, error: existingError } = await database.from("applications").select("*");
  if (existingError) throw new Error(`Could not load existing applications: ${existingError.message}`);
  const existingRows = (existing || []) as Array<Record<string, unknown>>;
  const starAnchorRows = await readAllRows<{ id: string; application_starred_at: string | null }>(
    database,
    "emails",
    "id,application_starred_at",
  );
  const starAnchors = new Map(
    starAnchorRows
      .filter((email) => Boolean(email.application_starred_at))
      .map((email) => [email.id, String(email.application_starred_at)]),
  );
  const existingIds = existingRows.map((application) => String(application.id));
  const existingIdSet = new Set(existingIds);
  const promotedByApplicationId = new Map<string, Record<string, unknown>>();
  try {
    // Read the compact staging table in ordinary pages. Building `.in(...)`
    // filters from hundreds of UUIDs creates very long PostgREST URLs and can
    // surface as a generic `TypeError: fetch failed` before Supabase receives
    // the request.
    const resolutionRows = await readAllRows<Record<string, unknown>>(
      database,
      "application_company_resolutions",
      "application_id,employer_name,title_name,promoted_company_at,promoted_title_at",
    );
    for (const resolution of resolutionRows) {
      const applicationId = String(resolution.application_id);
      if (existingIdSet.has(applicationId)) promotedByApplicationId.set(applicationId, resolution);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/application_company_resolutions|schema cache/i.test(message)) {
      throw new Error(`Could not load promoted application identities: ${message}`);
    }
  }
  const existingByKey = new Map(
    existingRows.map((application) => [`${application.gmail_account_id}:${application.grouping_key}`, application]),
  );
  const manualByKey = new Map(
    existingRows
      .filter((application) => application.grouping_source === "manual")
      .map((application) => [`${application.gmail_account_id}:${application.grouping_key}`, application]),
  );

  const applicationRows = candidates.map((candidate) => {
    const key = `${candidate.gmailAccountId}:${candidate.groupingKey}`;
    const manual = manualByKey.get(key);
    const current = existingByKey.get(key);
    const promoted = current ? promotedByApplicationId.get(String(current.id)) : null;
    const promotedCompany = promoted?.promoted_company_at && typeof promoted.employer_name === "string"
      ? promoted.employer_name
      : null;
    const promotedTitle = promoted?.promoted_title_at && typeof promoted.title_name === "string"
      ? promoted.title_name
      : null;
    const star = applicationStarState(
      candidate.messages.map((message) => message.emailId),
      starAnchors,
    );
    return {
      gmail_account_id: candidate.gmailAccountId,
      grouping_key: candidate.groupingKey,
      company: manual ? manual.company : (promotedCompany || candidate.company),
      role: manual ? manual.role : (promotedTitle || candidate.role),
      requisition_id: manual ? manual.requisition_id : candidate.requisitionId,
      current_status: manual ? manual.current_status : candidate.currentStatus,
      first_activity_at: candidate.firstActivityAt,
      last_activity_at: candidate.lastActivityAt,
      ghosted_at: manual ? manual.ghosted_at : candidate.ghostedAt,
      grouping_source: manual ? "manual" : "deterministic",
      manual_notes: manual ? manual.manual_notes : "",
      is_starred: star.is_starred,
      starred_at: star.starred_at,
    };
  });

  const savedRows: Array<{ id: string; gmail_account_id: string; grouping_key: string }> = [];
  options.onProgress?.({ stage: "saving_applications", percent: 45 });
  for (let offset = 0; offset < applicationRows.length; offset += WRITE_BATCH_SIZE) {
    const { data, error } = await database
      .from("applications")
      .upsert(applicationRows.slice(offset, offset + WRITE_BATCH_SIZE), {
        onConflict: "gmail_account_id,grouping_key",
        ignoreDuplicates: false,
      })
      .select("id,gmail_account_id,grouping_key");
    if (error) throw new Error(`Could not save applications. Apply migration 006 first. ${error.message}`);
    savedRows.push(...((data || []) as typeof savedRows));
  }

  const applicationIds = new Map(
    savedRows.map((row) => [`${row.gmail_account_id}:${row.grouping_key}`, row.id]),
  );
  const activeKeys = new Set(applicationIds.keys());
  const staleDeterministicIds = existingRows
    .filter((application) => application.grouping_source === "deterministic")
    .filter((application) => !activeKeys.has(`${application.gmail_account_id}:${application.grouping_key}`))
    .map((application) => String(application.id));

  const accountApplicationIds = existingRows
    .map((application) => String(application.id))
    .concat(savedRows.map((application) => application.id));
  const uniqueApplicationIds = [...new Set(accountApplicationIds)];
  options.onProgress?.({ stage: "refreshing_links", percent: 60 });
  await deleteInBatches(database, "application_messages", "application_id", uniqueApplicationIds, (query) =>
    query.eq("association_source", "deterministic"));
  await deleteInBatches(database, "application_status_events", "application_id", uniqueApplicationIds, (query) =>
    query.in("source", ["email_classification", "human_correction", "ghosting_rule"]));
  await deleteInBatches(database, "applications", "id", staleDeterministicIds);

  const messageRows: Array<Record<string, unknown>> = [];
  const eventRows: Array<Record<string, unknown>> = [];
  for (const candidate of candidates) {
    const applicationId = applicationIds.get(`${candidate.gmailAccountId}:${candidate.groupingKey}`);
    if (!applicationId) throw new Error(`Application id was not returned for ${candidate.groupingKey}`);
    messageRows.push(...candidate.messages.map((message) => ({
      application_id: applicationId,
      email_id: message.emailId,
      association_source: "deterministic",
      association_confidence: message.confidence,
    })));
    eventRows.push(...candidate.events.map((event) => ({
      application_id: applicationId,
      email_id: event.emailId,
      status: event.status,
      event_at: event.eventAt,
      source: event.source,
      explanation: event.explanation,
    })));
  }

  for (let offset = 0; offset < messageRows.length; offset += WRITE_BATCH_SIZE) {
    const { error } = await database.from("application_messages").upsert(
      messageRows.slice(offset, offset + WRITE_BATCH_SIZE),
      // email_id is globally unique in application_messages. Using it as the
      // conflict target lets deterministic regrouping move an email from its
      // previous application to the canonical Gmail-thread application.
      { onConflict: "email_id", ignoreDuplicates: false },
    );
    if (error) throw new Error(`Could not save application messages: ${error.message}`);
  }
  options.onProgress?.({ stage: "building_analytics", percent: 85 });
  for (let offset = 0; offset < eventRows.length; offset += WRITE_BATCH_SIZE) {
    const { error } = await database.from("application_status_events").upsert(
      eventRows.slice(offset, offset + WRITE_BATCH_SIZE),
      { onConflict: "application_id,email_id,status", ignoreDuplicates: false },
    );
    if (error) throw new Error(`Could not save lifecycle events: ${error.message}`);
  }

  // A failed or interrupted historical rebuild can leave an application row
  // after all of its messages have moved to a canonical thread group. Remove
  // those deterministic shells only after the new links are safely written.
  const [currentApplications, currentLinks] = await Promise.all([
    readAllRows<{ id: string; grouping_source: string }>(database, "applications", "id,grouping_source"),
    readAllRows<{ application_id: string }>(database, "application_messages", "application_id"),
  ]);
  const orphanedIds = unlinkedDeterministicApplicationIds(currentApplications, currentLinks);
  await deleteInBatches(database, "applications", "id", orphanedIds);

  const statusCounts = candidates.reduce<Record<string, number>>((counts, candidate) => {
    counts[candidate.currentStatus] = (counts[candidate.currentStatus] || 0) + 1;
    return counts;
  }, {});
  options.onProgress?.({ stage: "complete", percent: 100 });
  return {
    classified_email_count: evidence.length,
    application_count: currentApplications.length - orphanedIds.length,
    message_count: messageRows.length,
    event_count: eventRows.length,
    status_counts: statusCounts,
    relationship_checks: relationshipEvaluation.checkedCount,
    relationship_matches: relationshipEvaluation.matchedCount,
    relationship_failures: relationshipEvaluation.failedCount,
    relationship_input_tokens: relationshipEvaluation.inputTokens,
  };
}
