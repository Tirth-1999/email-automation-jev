import { createHash } from "node:crypto";
import type {
  HumanCategory,
  HumanLabelInput,
} from "./classification-types.js";
import type { LabeledEmail } from "./labeling-store.js";

export function humanDatasetVersion(emails: LabeledEmail[]): string {
  const canonical = emails
    .map((email) => `${email.email_id}\t${email.manual_label}\t${email.labeled_at}`)
    .sort()
    .join("\n");
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

export function humanLabelImportRows(emails: LabeledEmail[]): HumanLabelInput[] {
  const categories = new Set<HumanCategory>([
    "applied",
    "outreach",
    "reply_needed",
    "information_needed",
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
      notes: email.review_notes || "",
    };
  });
}
