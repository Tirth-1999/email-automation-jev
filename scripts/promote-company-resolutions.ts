import "dotenv/config";
import { createDatabaseClient } from "../lib/repository.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value === "replace_me") throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const inline = process.argv.find((argument) => argument.startsWith("--threshold="))?.split("=")[1];
const threshold = Number(inline || "0.90");
if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error("--threshold must be between 0 and 1");

const database = createDatabaseClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"));
const { data, error } = await database.rpc("promote_high_confidence_application_identities", {
  p_minimum_score: threshold,
});
if (error) throw new Error(`Could not promote company resolutions. Apply migration 012 first. ${error.message}`);
console.log(JSON.stringify(data, null, 2));
