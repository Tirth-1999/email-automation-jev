import { APPLICATION_STATUSES } from "./application-grouping.js";

export interface ApplicationBoardSnapshot {
  generated_at: string;
  by_status: Record<string, Array<Record<string, unknown>>>;
  starred: Array<Record<string, unknown>>;
}

export function buildApplicationBoardSnapshot(
  boardRows: Array<Record<string, unknown>>,
  starRows: Array<Record<string, unknown>>,
  generatedAt = new Date().toISOString(),
): ApplicationBoardSnapshot {
  const starState = new Map(starRows.map((row) => [String(row.id), {
    is_starred: Boolean(row.is_starred),
    starred_at: typeof row.starred_at === "string" ? row.starred_at : null,
  }]));
  const enriched: Array<Record<string, unknown>> = boardRows.map((application) => ({
    ...application,
    ...(starState.get(String(application.id)) || { is_starred: false, starred_at: null }),
  }));
  const byStatus = Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, []])) as Record<string, Array<Record<string, unknown>>>;
  for (const application of enriched) {
    const status = String(application.current_status || "");
    if (byStatus[status]) byStatus[status].push(application);
  }
  const starred = enriched
    .filter((application) => application.is_starred === true)
    .sort((left, right) => Date.parse(String(right.starred_at || "")) - Date.parse(String(left.starred_at || "")));
  return { generated_at: generatedAt, by_status: byStatus, starred };
}
