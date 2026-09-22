from __future__ import annotations

import re
from datetime import UTC, datetime

from supabase import Client, create_client

from .models import GmailAccount, NormalizedEmail, SyncCounts, SyncType


def utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def safe_error_message(error: BaseException) -> str:
    message = re.sub(r"Bearer\s+\S+", "Bearer [redacted]", str(error), flags=re.I)
    return message[:2000]


def create_database_client(url: str, service_role_key: str) -> Client:
    return create_client(url, service_role_key)


def ensure_gmail_account(database: Client, gmail_address: str) -> GmailAccount:
    response = database.table("gmail_accounts").upsert({"gmail_address": gmail_address.lower()}, on_conflict="gmail_address").execute()
    if not response.data:
        response = database.table("gmail_accounts").select("id,gmail_address,latest_history_id").eq("gmail_address", gmail_address.lower()).single().execute()
        row = response.data
    else:
        row = response.data[0]
    return GmailAccount(row["id"], row["gmail_address"], row.get("latest_history_id"))


def start_sync_run(database: Client, account_id: str, sync_type: SyncType) -> str:
    database.table("gmail_accounts").update({"sync_status": "running", "last_error": None}).eq("id", account_id).execute()
    response = database.table("sync_runs").insert({"gmail_account_id": account_id, "sync_type": sync_type}).execute()
    return str(response.data[0]["id"])


def upsert_emails(database: Client, account_id: str, emails: list[NormalizedEmail]) -> tuple[int, int]:
    if not emails:
        return 0, 0
    message_ids = [email["gmail_message_id"] for email in emails]
    existing_response = database.table("emails").select("gmail_message_id").eq("gmail_account_id", account_id).in_("gmail_message_id", message_ids).execute()
    existing = {row["gmail_message_id"] for row in existing_response.data}
    rows = [{"gmail_account_id": account_id, **email} for email in emails]
    database.table("emails").upsert(rows, on_conflict="gmail_account_id,gmail_message_id").execute()
    updated = sum(message_id in existing for message_id in message_ids)
    return len(message_ids) - updated, updated


def find_existing_message_ids(database: Client, account_id: str, ids: list[str]) -> set[str]:
    if not ids:
        return set()
    response = database.table("emails").select("gmail_message_id").eq("gmail_account_id", account_id).in_("gmail_message_id", ids).execute()
    return {row["gmail_message_id"] for row in response.data}


def mark_messages_deleted(database: Client, account_id: str, ids: list[str]) -> int:
    if not ids:
        return 0
    response = (
        database.table("emails")
        .update({"deleted_at": utc_now()})
        .eq("gmail_account_id", account_id)
        .in_("gmail_message_id", ids)
        .is_("deleted_at", "null")
        .execute()
    )
    return len(response.data)


def _count_values(counts: SyncCounts) -> dict[str, int]:
    return {
        "discovered_count": counts.discovered,
        "inserted_count": counts.inserted,
        "updated_count": counts.updated,
        "deleted_count": counts.deleted,
        "skipped_count": counts.skipped,
    }


def complete_sync_run(
    database: Client,
    *,
    account_id: str,
    run_id: str,
    history_id: str,
    counts: SyncCounts,
) -> None:
    finished_at = utc_now()
    database.table("sync_runs").update({"status": "succeeded", "finished_at": finished_at, **_count_values(counts)}).eq("id", run_id).execute()
    database.table("gmail_accounts").update(
        {
            "latest_history_id": history_id,
            "last_synced_at": finished_at,
            "sync_status": "idle",
            "last_error": None,
        }
    ).eq("id", account_id).execute()


def fail_sync_run(
    database: Client,
    *,
    account_id: str,
    run_id: str,
    error: BaseException,
    counts: SyncCounts,
) -> None:
    message = safe_error_message(error)
    database.table("sync_runs").update(
        {
            "status": "failed",
            "finished_at": utc_now(),
            "error_message": message,
            **_count_values(counts),
        }
    ).eq("id", run_id).execute()
    database.table("gmail_accounts").update({"sync_status": "error", "last_error": message}).eq("id", account_id).execute()
