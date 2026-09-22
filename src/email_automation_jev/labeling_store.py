from __future__ import annotations

import json
import os
from collections.abc import Callable
from pathlib import Path
from typing import Any

from supabase import Client

from .labeling_sample import LabelingEmail


def read_all_active_emails(database: Client, on_progress: Callable[[int, int | None], None] | None = None) -> list[LabelingEmail]:
    page_size, offset, total = 500, 0, None
    emails: list[LabelingEmail] = []
    fields = "id,gmail_message_id,gmail_thread_id,internal_date,direction,from_name,from_email,to_recipients,subject,snippet,body_text,label_ids"
    while True:
        query = (
            database.table("emails")
            .select(fields, count="exact" if offset == 0 else None)
            .is_("deleted_at", "null")
            .order("id")
            .range(offset, offset + page_size - 1)
        )
        response = query.execute()
        rows = response.data or []
        if offset == 0:
            total = response.count
        emails.extend(rows)
        if on_progress:
            on_progress(len(emails), total)
        if len(rows) < page_size:
            break
        offset += page_size
    return emails


def to_review_email(
    email: LabelingEmail,
    index: int,
    batch_id: str,
    selection_reason: str,
    body_characters: int = 20_000,
) -> dict[str, Any]:
    body = email["body_text"]
    if len(body) > body_characters:
        body = f"{body[:body_characters]}\n\n[Body truncated for labeling sample]"
    return {
        "sample_index": index,
        "batch_id": batch_id,
        "email_id": email["id"],
        "gmail_message_id": email["gmail_message_id"],
        "gmail_thread_id": email["gmail_thread_id"],
        "internal_date": email["internal_date"],
        "direction": email["direction"],
        "from_name": email["from_name"],
        "from_email": email["from_email"],
        "to_recipients": email["to_recipients"],
        "subject": email["subject"],
        "snippet": email["snippet"],
        "body_text": body,
        "gmail_label_ids": email["label_ids"],
        "selection_reason": selection_reason,
    }


def read_json(path: str | Path) -> Any:
    return json.loads(Path(path).read_text())


def write_private_json(path: str | Path, value: object) -> None:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    os.chmod(temporary, 0o600)
    temporary.replace(destination)
    os.chmod(destination, 0o600)
