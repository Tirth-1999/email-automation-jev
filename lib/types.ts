export type SyncType = "full" | "incremental" | "recovery_full";

export interface AddressValue {
  name: string | null;
  email: string | null;
  raw: string;
}

export interface AttachmentMetadata {
  filename: string;
  mimeType: string;
  attachmentId: string | null;
  size: number | null;
}

export interface NormalizedEmail {
  gmail_message_id: string;
  gmail_thread_id: string;
  rfc_message_id: string | null;
  gmail_history_id: string | null;
  internal_date: string;
  direction: "incoming" | "outgoing" | "unknown";
  from_name: string | null;
  from_email: string | null;
  to_recipients: AddressValue[];
  cc_recipients: AddressValue[];
  subject: string;
  snippet: string;
  body_text: string;
  body_html: string;
  label_ids: string[];
  attachment_metadata: AttachmentMetadata[];
  raw_headers: Record<string, string>;
  size_estimate: number | null;
  deleted_at: null;
}

export interface SyncCounts {
  discovered: number;
  inserted: number;
  updated: number;
  deleted: number;
  skipped: number;
}

export interface GmailAccountRow {
  id: string;
  gmail_address: string;
  latest_history_id: string | null;
}
