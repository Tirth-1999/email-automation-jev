from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import Any, Literal

from googleapiclient.discovery import Resource

from supabase import Client

from .email_parser import normalize_gmail_message
from .gmail_client import (
    RequestRunner,
    fetch_messages,
    is_expired_history_error,
    list_full_sync_message_pages,
    list_incremental_changes,
)
from .models import GmailAccount, IngestionResult, SyncCounts
from .repository import (
    complete_sync_run,
    fail_sync_run,
    find_existing_message_ids,
    mark_messages_deleted,
    start_sync_run,
    upsert_emails,
)

Progress = Callable[[str, dict[str, Any] | None], None]


def _chunks(values: list[str], size: int) -> Iterable[list[str]]:
    for index in range(0, len(values), max(size, 1)):
        yield values[index : index + max(size, 1)]


class Ingestion:
    def __init__(
        self,
        *,
        database: Client,
        gmail: Resource,
        requests: RequestRunner,
        account: GmailAccount,
        profile_history_id: str,
        force_full: bool,
        resume_full: bool,
        query: str,
        include_spam_trash: bool,
        include_outgoing: bool,
        max_messages: int,
        fetch_concurrency: int,
        upsert_batch_size: int,
        on_progress: Progress | None = None,
    ) -> None:
        self.database, self.gmail, self.requests = database, gmail, requests
        self.account, self.profile_history_id = account, profile_history_id
        self.force_full, self.resume_full = force_full, resume_full
        self.query, self.include_spam_trash = query, include_spam_trash
        self.include_outgoing, self.max_messages = include_outgoing, max_messages
        self.fetch_concurrency, self.upsert_batch_size = fetch_concurrency, upsert_batch_size
        self.on_progress = on_progress

    def progress(self, message: str, stats: dict[str, Any] | None = None) -> None:
        if self.on_progress:
            self.on_progress(message, stats)

    def persist(self, ids: list[str], counts: SyncCounts) -> None:
        processed = 0
        for iteration, id_batch in enumerate(_chunks(ids, self.upsert_batch_size), 1):
            messages, missing = fetch_messages(self.gmail, id_batch, self.fetch_concurrency, self.requests)
            if missing:
                counts.deleted += mark_messages_deleted(self.database, self.account.id, missing)
            parsed = [normalize_gmail_message(message, self.account.gmail_address) for message in messages]
            normalized = []
            for email in parsed:
                skip = "DRAFT" in email["label_ids"] or (not self.include_outgoing and email["direction"] == "outgoing")
                if skip:
                    counts.skipped += 1
                else:
                    normalized.append(email)
            inserted, updated = upsert_emails(self.database, self.account.id, normalized)
            counts.inserted += inserted
            counts.updated += updated
            processed += len(id_batch)
            self.progress(
                f"Database writes: {counts.inserted + counts.updated}; already stored or filtered: {counts.skipped}; discovered: {counts.discovered}",
                {
                    "stage": "fetching",
                    "iteration": iteration,
                    "pending": max(0, len(ids) - processed),
                    "inserted": counts.inserted,
                    "updated": counts.updated,
                    "skipped": counts.skipped,
                    "deleted": counts.deleted,
                },
            )

    def full(self, sync_type: Literal["full", "recovery_full"]) -> IngestionResult:
        counts = SyncCounts()
        run_id = start_sync_run(self.database, self.account.id, sync_type)
        try:
            discovered: set[str] = set()
            for page, ids in enumerate(
                list_full_sync_message_pages(
                    self.gmail,
                    query=self.query,
                    include_spam_trash=self.include_spam_trash,
                    max_messages=self.max_messages,
                    requests=self.requests,
                ),
                1,
            ):
                discovered.update(ids)
                self.progress(
                    f"Discovered {len(discovered)} message IDs",
                    {"stage": "discovering", "page": page, "discovered": len(discovered)},
                )
            initial = list(discovered)
            counts.discovered = len(initial)
            existing: set[str] = set()
            for iteration, batch in enumerate(_chunks(initial, self.upsert_batch_size), 1):
                existing.update(find_existing_message_ids(self.database, self.account.id, batch))
                self.progress(
                    f"Compared {min(iteration * self.upsert_batch_size, len(initial))}/{len(initial)} IDs with Supabase",
                    {
                        "stage": "comparing",
                        "iteration": iteration,
                        "existing": len(existing),
                        "pending": len(initial) - len(existing) if self.resume_full else len(initial),
                    },
                )
            to_fetch = [item for item in initial if item not in existing] if self.resume_full else initial
            if self.resume_full:
                counts.skipped += len(existing)
            self.persist(to_fetch, counts)
            self.progress(
                "Checking Gmail history for messages that changed during the full import",
                {"stage": "catching_up", "pending": 0},
            )
            catch_up = list_incremental_changes(self.gmail, self.profile_history_id, self.requests)
            counts.discovered += len([item for item in catch_up["changed_message_ids"] if item not in discovered])
            self.persist(catch_up["changed_message_ids"], counts)
            counts.deleted += mark_messages_deleted(self.database, self.account.id, catch_up["deleted_message_ids"])
            history_id = catch_up["next_history_id"]
            complete_sync_run(
                self.database,
                account_id=self.account.id,
                run_id=run_id,
                history_id=history_id,
                counts=counts,
            )
            return IngestionResult(sync_type, counts, history_id)
        except BaseException as error:
            fail_sync_run(self.database, account_id=self.account.id, run_id=run_id, error=error, counts=counts)
            raise

    def incremental(self) -> IngestionResult:
        counts = SyncCounts()
        run_id = start_sync_run(self.database, self.account.id, "incremental")
        try:
            changes = list_incremental_changes(self.gmail, self.account.latest_history_id or "", self.requests)
            counts.discovered = len(changes["changed_message_ids"])
            self.persist(changes["changed_message_ids"], counts)
            counts.deleted += mark_messages_deleted(self.database, self.account.id, changes["deleted_message_ids"])
            history_id = changes["next_history_id"]
            complete_sync_run(
                self.database,
                account_id=self.account.id,
                run_id=run_id,
                history_id=history_id,
                counts=counts,
            )
            return IngestionResult("incremental", counts, history_id)
        except BaseException as error:
            fail_sync_run(self.database, account_id=self.account.id, run_id=run_id, error=error, counts=counts)
            raise

    def run(self) -> IngestionResult:
        if self.force_full:
            if self.resume_full and self.account.latest_history_id:
                try:
                    self.incremental()
                except BaseException as error:
                    if not is_expired_history_error(error):
                        raise
            return self.full("full")
        if not self.account.latest_history_id:
            return self.full("full")
        try:
            return self.incremental()
        except BaseException as error:
            if not is_expired_history_error(error):
                raise
            self.progress("Gmail history cursor expired; starting a recovery full sync")
            return self.full("recovery_full")


def run_ingestion(**options: Any) -> IngestionResult:
    return Ingestion(**options).run()
