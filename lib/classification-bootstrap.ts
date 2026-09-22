import { createHash } from "node:crypto";
import type {
  HumanCategory,
  HumanLabelEventInput,
  JsonObject,
} from "./classification-types.js";
import type { LabeledEmail } from "./labeling-store.js";

export function humanDatasetVersion(emails: LabeledEmail[]): string {
  const canonical = emails
    .map((email) => `${email.email_id}\t${email.manual_label}\t${email.labeled_at}`)
    .sort()
    .join("\n");
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

export function humanLabelImportRows(emails: LabeledEmail[]): HumanLabelEventInput[] {
  const categories = new Set<HumanCategory>([
    "applied",
    "outreach",
    "reply_needed",
    "interview_assessment",
    "offer",
    "rejected",
    "other",
    "uncertain",
  ]);
  return emails.map((email) => {
    if (!categories.has(email.manual_label as HumanCategory)) {
      throw new Error(`Invalid human category for ${email.email_id}: ${email.manual_label}`);
    }
    return {
      email_id: email.email_id,
      source_key: `initial-json:${email.email_id}:${email.labeled_at}`,
      category: email.manual_label as HumanCategory,
      source: "review_ui",
      reviewer_label: "initial-json-import",
      notes: email.review_notes || "",
    };
  });
}

export function benchmarkSummary(report: JsonObject): JsonObject {
  return {
    generated_at: report.generated_at,
    evaluation_scope: report.evaluation_scope,
    model_requested: report.model_requested,
    model_returned: report.model_returned,
    minimum_top_probability: report.minimum_top_probability,
    metrics: report.metrics,
    per_category: report.per_category,
    confusion_matrix: report.confusion_matrix,
  };
}
