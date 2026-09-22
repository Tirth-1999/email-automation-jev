from __future__ import annotations

import base64
import re
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from typing import Any

from bs4 import BeautifulSoup

from .models import AddressValue, AttachmentMetadata, Direction, NormalizedEmail

PRESERVED_HEADERS = (
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
)


def decode_base64url(value: str | None = None) -> str:
    if not value:
        return ""
    padded = value + "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")


def _split_addresses(value: str) -> list[str]:
    addresses: list[str] = []
    current: list[str] = []
    in_quotes = False
    angle_depth = 0
    for character in value:
        if character == '"':
            in_quotes = not in_quotes
        elif not in_quotes and character == "<":
            angle_depth += 1
        elif not in_quotes and character == ">":
            angle_depth = max(0, angle_depth - 1)
        if character == "," and not in_quotes and angle_depth == 0:
            if "".join(current).strip():
                addresses.append("".join(current).strip())
            current = []
        else:
            current.append(character)
    if "".join(current).strip():
        addresses.append("".join(current).strip())
    return addresses


def parse_address_list(value: str | None = None) -> list[AddressValue]:
    if not value or not value.strip():
        return []
    result: list[AddressValue] = []
    for raw in _split_addresses(value):
        bracket = re.match(r'^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$', raw)
        if bracket:
            result.append(
                {
                    "name": bracket.group(1).strip() or None,
                    "email": bracket.group(2).strip().lower() or None,
                    "raw": raw,
                }
            )
            continue
        email = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", raw, re.I)
        result.append({"name": None, "email": email.group(0).lower() if email else None, "raw": raw})
    return result


def _collect_parts(
    part: dict[str, Any] | None,
    plain: list[str],
    html: list[str],
    attachments: list[AttachmentMetadata],
) -> None:
    if not part:
        return
    mime_type = part.get("mimeType") or "application/octet-stream"
    filename = part.get("filename") or ""
    body = part.get("body") or {}
    data = body.get("data")
    if filename or body.get("attachmentId"):
        attachments.append(
            {
                "filename": filename,
                "mimeType": mime_type,
                "attachmentId": body.get("attachmentId"),
                "size": body.get("size"),
            }
        )
    elif mime_type == "text/plain" and data:
        plain.append(decode_base64url(data))
    elif mime_type == "text/html" and data:
        html.append(decode_base64url(data))
    for child in part.get("parts") or []:
        _collect_parts(child, plain, html, attachments)


def _compact_bodies(values: list[str]) -> str:
    return "\n\n".join(dict.fromkeys(value.strip() for value in values if value.strip()))


def _headers(message: dict[str, Any]) -> dict[str, str]:
    return {
        str(header.get("name", "")).strip().lower(): str(header.get("value", ""))
        for header in (message.get("payload") or {}).get("headers", [])
        if str(header.get("name", "")).strip()
    }


def _internal_date(message: dict[str, Any], headers: dict[str, str]) -> str:
    raw = message.get("internalDate")
    if raw and str(raw).isdigit() and int(raw) > 0:
        timestamp = datetime.fromtimestamp(int(raw) / 1000, tz=UTC)
    else:
        try:
            timestamp = parsedate_to_datetime(headers.get("date", ""))
        except (TypeError, ValueError) as error:
            raise ValueError(f"Message {message.get('id', 'unknown')} has no valid date") from error
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=UTC)
    return timestamp.astimezone(UTC).isoformat().replace("+00:00", "Z")


def normalize_gmail_message(message: dict[str, Any], account_address: str) -> NormalizedEmail:
    message_id = message.get("id")
    thread_id = message.get("threadId")
    if not message_id or not thread_id:
        raise ValueError("Gmail message is missing id or threadId")
    headers = _headers(message)
    plain_parts: list[str] = []
    html_parts: list[str] = []
    attachments: list[AttachmentMetadata] = []
    _collect_parts(message.get("payload"), plain_parts, html_parts, attachments)
    body_html = _compact_bodies(html_parts)
    body_text = _compact_bodies(plain_parts)
    if not body_text and body_html:
        soup = BeautifulSoup(body_html, "html.parser")
        for tag in soup(["style", "script", "img"]):
            tag.decompose()
        body_text = " ".join(soup.get_text(" ", strip=True).split())
        body_text = re.sub(r"\s+([.,!?;:])", r"\1", body_text)
    senders = parse_address_list(headers.get("from"))
    sender = senders[0] if senders else None
    sender_email = sender["email"].lower() if sender and sender["email"] else None
    direction: Direction = "unknown"
    if sender_email:
        direction = "outgoing" if sender_email == account_address.lower() else "incoming"
    return {
        "gmail_message_id": str(message_id),
        "gmail_thread_id": str(thread_id),
        "rfc_message_id": headers.get("message-id") or None,
        "gmail_history_id": message.get("historyId"),
        "internal_date": _internal_date(message, headers),
        "direction": direction,
        "from_name": sender["name"] if sender else None,
        "from_email": sender_email,
        "to_recipients": parse_address_list(headers.get("to")),
        "cc_recipients": parse_address_list(headers.get("cc")),
        "subject": headers.get("subject", ""),
        "snippet": message.get("snippet") or "",
        "body_text": body_text,
        "body_html": body_html,
        "label_ids": message.get("labelIds") or [],
        "attachment_metadata": attachments,
        "raw_headers": {name: headers[name] for name in PRESERVED_HEADERS if name in headers},
        "size_estimate": message.get("sizeEstimate"),
        "deleted_at": None,
    }
