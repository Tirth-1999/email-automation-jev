export type GmailDeepLinkIdentity = {
  gmail_message_id?: string | null;
  gmail_thread_id?: string | null;
  rfc_message_id?: string | null;
};

const GMAIL_BASE_URL = "https://mail.google.com/mail/u/0/";

function clean(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function buildGmailDeepLink(identity: GmailDeepLinkIdentity): string {
  const rfcMessageId = clean(identity.rfc_message_id).replace(/^<|>$/g, "");
  if (rfcMessageId) {
    const query = `in:anywhere rfc822msgid:${rfcMessageId}`;
    return `${GMAIL_BASE_URL}#search/${encodeURIComponent(query)}`;
  }

  const threadId = clean(identity.gmail_thread_id);
  if (threadId) return `${GMAIL_BASE_URL}#all/${encodeURIComponent(threadId)}`;

  const messageId = clean(identity.gmail_message_id);
  if (messageId) return `${GMAIL_BASE_URL}#all/${encodeURIComponent(messageId)}`;

  return GMAIL_BASE_URL;
}
