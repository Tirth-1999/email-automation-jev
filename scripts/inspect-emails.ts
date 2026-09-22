import "dotenv/config";
import { createDatabaseClient } from "../lib/repository.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const database = createDatabaseClient(
  required("SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
);

const { data, error, count } = await database
  .from("emails")
  .select(
    "gmail_message_id,internal_date,from_email,subject,gmail_thread_id",
    { count: "exact" },
  )
  .is("deleted_at", null)
  .order("internal_date", { ascending: false })
  .limit(20);

if (error) throw new Error(`Could not inspect messages: ${error.message}`);

console.log(`Active messages: ${count ?? "unknown"}`);
console.table(data || []);
