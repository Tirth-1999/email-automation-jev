import { htmlToText } from "html-to-text";
import type { gmail_v1 } from "googleapis";
import type {
  AddressValue,
  AttachmentMetadata,
  NormalizedEmail,
} from "./types.js";

const PRESERVED_HEADERS = [
  "date",
  "from",
  "to",
  "cc",
  "reply-to",
  "subject",
  "message-id",
  "in-reply-to",
  "references",
  "list-unsubscribe",
] as const;

export function decodeBase64Url(value?: string | null): string {
  if (!value) return "";
  return Buffer.from(value, "base64url").toString("utf8");
}
function splitAddresses(value: string): string[] {
  const addresses: string[] = [];
  let current = "";
  let inQuotes = false;
  let angleDepth = 0;

  for (const character of value) {
    if (character === '"') inQuotes = !inQuotes;
    if (!inQuotes && character === "<") angleDepth += 1;
    if (!inQuotes && character === ">") angleDepth = Math.max(0, angleDepth - 1);
    if (character === "," && !inQuotes && angleDepth === 0) {
      if (current.trim()) addresses.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  if (current.trim()) addresses.push(current.trim());
  return addresses;
}

export function parseAddressList(value?: string): AddressValue[] {
  if (!value?.trim()) return [];
  return splitAddresses(value).map((raw) => {
    const bracketMatch = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
    if (bracketMatch) {
      return {
        name: bracketMatch[1]?.trim() || null,
        email: bracketMatch[2]?.trim().toLowerCase() || null,
        raw,
      };
    }

    const emailMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return {
      name: null,
      email: emailMatch?.[0]?.toLowerCase() || null,
      raw,
    };
  });
}

function collectParts(
  part: gmail_v1.Schema$MessagePart | undefined,
  plain: string[],
  html: string[],
  attachments: AttachmentMetadata[],
): void {
  if (!part) return;

  const mimeType = part.mimeType || "application/octet-stream";
  const filename = part.filename || "";
  const data = part.body?.data;

  if (filename || part.body?.attachmentId) {
    attachments.push({
      filename,
      mimeType,
      attachmentId: part.body?.attachmentId || null,
      size: part.body?.size ?? null,
    });
  } else if (mimeType === "text/plain" && data) {
    plain.push(decodeBase64Url(data));
  } else if (mimeType === "text/html" && data) {
    html.push(decodeBase64Url(data));
  }

  for (const child of part.parts || []) {
    collectParts(child, plain, html, attachments);
  }
}

function compactBodies(values: string[]): string {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].join("\n\n");
}

function headerMap(message: gmail_v1.Schema$Message): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const header of message.payload?.headers || []) {
    const name = header.name?.trim().toLowerCase();
    if (name && header.value != null) headers[name] = header.value;
  }
  return headers;
}

function isoInternalDate(message: gmail_v1.Schema$Message, headers: Record<string, string>): string {
  const gmailTimestamp = Number(message.internalDate);
  const fallbackTimestamp = Date.parse(headers.date || "");
  const timestamp = Number.isFinite(gmailTimestamp) && gmailTimestamp > 0
    ? gmailTimestamp
    : fallbackTimestamp;

  if (!Number.isFinite(timestamp)) {
    throw new Error(`Message ${message.id || "unknown"} has no valid date`);
  }
  return new Date(timestamp).toISOString();
}

export function normalizeGmailMessage(
  message: gmail_v1.Schema$Message,
  accountAddress: string,
): NormalizedEmail {
  if (!message.id || !message.threadId) {
    throw new Error("Gmail message is missing id or threadId");
  }

  const headers = headerMap(message);
  const plainParts: string[] = [];
  const htmlParts: string[] = [];
  const attachments: AttachmentMetadata[] = [];
  collectParts(message.payload, plainParts, htmlParts, attachments);

  const bodyHtml = compactBodies(htmlParts);
  const explicitText = compactBodies(plainParts);
  const bodyText = explicitText || (bodyHtml
    ? htmlToText(bodyHtml, {
        wordwrap: false,
        selectors: [
          { selector: "img", format: "skip" },
          { selector: "style", format: "skip" },
        ],
      }).trim()
    : "");

  const senders = parseAddressList(headers.from);
  const sender = senders[0];
  const senderEmail = sender?.email?.toLowerCase() || null;
  const normalizedAccount = accountAddress.toLowerCase();
  const direction = senderEmail
    ? senderEmail === normalizedAccount
      ? "outgoing"
      : "incoming"
    : "unknown";

  const rawHeaders = Object.fromEntries(
    PRESERVED_HEADERS.flatMap((name) =>
      headers[name] === undefined ? [] : [[name, headers[name]]],
    ),
  );

  return {
    gmail_message_id: message.id,
    gmail_thread_id: message.threadId,
    rfc_message_id: headers["message-id"] || null,
    gmail_history_id: message.historyId || null,
    internal_date: isoInternalDate(message, headers),
    direction,
    from_name: sender?.name || null,
    from_email: senderEmail,
    to_recipients: parseAddressList(headers.to),
    cc_recipients: parseAddressList(headers.cc),
    subject: headers.subject || "",
    snippet: message.snippet || "",
    body_text: bodyText,
    body_html: bodyHtml,
    label_ids: message.labelIds || [],
    attachment_metadata: attachments,
    raw_headers: rawHeaders,
    size_estimate: message.sizeEstimate ?? null,
    deleted_at: null,
  };
}
