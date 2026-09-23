import "dotenv/config";
import { materializeApplications } from "../lib/application-materializer.js";
import { createDatabaseClient } from "../lib/repository.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main(): Promise<void> {
  const database = createDatabaseClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"));
  const result = await materializeApplications(database);
  console.log(`Grouped ${result.message_count.toLocaleString()} emails into ${result.application_count.toLocaleString()} applications.`);
  console.log(`Saved ${result.event_count.toLocaleString()} lifecycle events.`);
  console.log(`Jev checked ${result.relationship_checks.toLocaleString()} ambiguous same-thread relationships; ${result.relationship_matches.toLocaleString()} matched, ${result.relationship_failures.toLocaleString()} failed.`);
  console.log(result.status_counts);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
