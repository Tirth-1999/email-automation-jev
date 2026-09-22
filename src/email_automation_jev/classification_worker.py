from __future__ import annotations

import time
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Any, Literal

from typesafe_sdk import TypeSafeClient

from supabase import Client

from .classification_repository import (
    create_classification_run,
    enqueue_classification_emails,
    fail_classification_result,
    mark_classification_running,
    refresh_classification_run_counters,
    save_classification_result,
)
from .jev_classifier import classify_email_with_jev
from .repository import utc_now

RunScope = Literal["all", "unclassified", "failed", "uncertain"]


@dataclass(frozen=True)
class ClassificationConfig:
    model: str
    minimum_top_probability: float = 0.6
    concurrency: int = 5
    batch_size: int = 25
    max_retries: int = 6

    def __post_init__(self) -> None:
        if not 1 <= self.concurrency <= 10:
            raise ValueError("concurrency must be between 1 and 10")
        if not 1 <= self.batch_size <= 250:
            raise ValueError("batch_size must be between 1 and 250")
        if not 0 <= self.minimum_top_probability <= 1:
            raise ValueError("minimum_top_probability must be between 0 and 1")


def _is_transient(error: BaseException) -> bool:
    status = getattr(error, "status_code", None) or getattr(error, "status", None)
    response = getattr(error, "response", None) or getattr(error, "resp", None)
    status = getattr(response, "status_code", None) or getattr(response, "status", status)
    if status in (408, 409, 425, 429) or isinstance(status, int) and 500 <= status <= 599:
        return True
    message = str(error).lower()
    return any(token in message for token in ("rate limit", "quota exceeded", "temporarily unavailable", "timeout", "server error"))


def _retry_delay(attempt: int) -> float:
    return min(60.0, 2**attempt + (attempt * 0.137))


def _classify_with_retry(client: TypeSafeClient, email: dict[str, Any], config: ClassificationConfig) -> Any:
    for attempt in range(config.max_retries + 1):
        try:
            return classify_email_with_jev(client, email, model=config.model, minimum_top_probability=config.minimum_top_probability)
        except BaseException as error:
            if attempt >= config.max_retries or not _is_transient(error):
                raise
            time.sleep(_retry_delay(attempt))
    raise RuntimeError("classification retry loop ended unexpectedly")


def _email_query(database: Client, email_ids: list[str] | None = None) -> list[dict[str, Any]]:
    query = (
        database.table("emails")
        .select("id,gmail_message_id,gmail_thread_id,internal_date,direction,from_name,from_email,to_recipients,subject,snippet,body_text")
        .is_("deleted_at", "null")
        .order("id")
    )
    if email_ids:
        query = query.in_("id", email_ids)
    return query.execute().data or []


def _classified_ids(database: Client, account_id: str, scope: RunScope) -> set[str]:
    if scope in ("all", "failed"):
        return set()
    query = database.table("latest_email_classifications").select("email_id").eq("gmail_account_id", account_id)
    return {str(row["email_id"]) for row in (query.execute().data or [])}


def select_email_ids(
    database: Client,
    account_id: str,
    *,
    scope: RunScope = "unclassified",
    maximum: int | None = None,
    email_ids: list[str] | None = None,
) -> list[str]:
    if email_ids:
        candidates = [str(row["id"]) for row in _email_query(database, email_ids)]
    else:
        candidates = [str(row["id"]) for row in _email_query(database)]
    if scope == "unclassified":
        existing = _classified_ids(database, account_id, scope)
        candidates = [email_id for email_id in candidates if email_id not in existing]
    elif scope == "uncertain":
        uncertain = {
            str(row["email_id"])
            for row in (
                database.table("latest_email_classifications")
                .select("email_id")
                .eq("gmail_account_id", account_id)
                .eq("category_decision", "uncertain")
                .execute()
                .data
                or []
            )
        }
        candidates = [email_id for email_id in candidates if email_id in uncertain]
    elif scope == "failed":
        failed = {
            str(row["email_id"]) for row in (database.table("email_classification_results").select("email_id").eq("status", "failed").execute().data or [])
        }
        candidates = [email_id for email_id in candidates if email_id in failed]
    if maximum is not None:
        candidates = candidates[:maximum]
    return candidates


def preview_selection(database: Client, account_id: str, *, scope: RunScope = "unclassified", maximum: int | None = None) -> dict[str, int | str]:
    all_ids = select_email_ids(database, account_id, scope=scope)
    selected = min(len(all_ids), maximum) if maximum else len(all_ids)
    return {"scope": scope, "available_count": len(all_ids), "selected_count": selected, "batch_count": (selected + 24) // 25}


def _run_status(database: Client, run_id: str) -> dict[str, Any]:
    response = database.table("classification_runs").select("*").eq("id", run_id).single().execute()
    return response.data


def _email_by_id(database: Client, email_id: str) -> dict[str, Any]:
    rows = _email_query(database, [email_id])
    if not rows:
        raise ValueError(f"Email {email_id} no longer exists")
    return rows[0]


def _finish_run(database: Client, run_id: str, status: str, error: str | None = None) -> None:
    database.table("classification_runs").update({"status": status, "finished_at": utc_now(), "error_message": error}).eq("id", run_id).execute()
    refresh_classification_run_counters(database, run_id)


def run_classification(
    database: Client,
    *,
    run_id: str,
    config: ClassificationConfig,
    api_key: str | None = None,
) -> dict[str, Any]:
    run = _run_status(database, run_id)
    database.table("classification_runs").update({"status": "running", "started_at": run.get("started_at") or utc_now(), "error_message": None}).eq(
        "id", run_id
    ).execute()
    client = TypeSafeClient(api_key=api_key, model=config.model, timeout=30)
    queued = (
        database.table("email_classification_results").select("email_id").eq("run_id", run_id).eq("status", "queued").order("created_at").execute().data or []
    )
    cancelled = False

    def process(row: dict[str, Any]) -> str:
        email_id = str(row["email_id"])
        mark_classification_running(database, run_id, email_id)
        try:
            result = _classify_with_retry(client, _email_by_id(database, email_id), config)
            save_classification_result(database, run_id, email_id, result)
            return "succeeded"
        except BaseException as error:
            fail_classification_result(database, run_id, email_id, error)
            return "failed"

    for offset in range(0, len(queued), config.batch_size):
        current = queued[offset : offset + config.batch_size]
        if _run_status(database, run_id).get("cancellation_requested_at"):
            cancelled = True
            break
        with ThreadPoolExecutor(max_workers=min(config.concurrency, len(current))) as executor:
            futures: list[Future[str]] = [executor.submit(process, row) for row in current]
            for future in as_completed(futures):
                future.result()
        refresh_classification_run_counters(database, run_id)

    refresh_classification_run_counters(database, run_id)
    summary = _run_status(database, run_id)
    if cancelled:
        _finish_run(database, run_id, "cancelled")
    elif summary.get("failed_count", 0) and summary.get("succeeded_count", 0):
        _finish_run(database, run_id, "partial")
    elif summary.get("failed_count", 0):
        _finish_run(database, run_id, "failed", "All queued email classifications failed")
    else:
        _finish_run(database, run_id, "succeeded")
    return _run_status(database, run_id)


def create_and_run(
    database: Client,
    *,
    account_id: str,
    classifier_version_id: str,
    config: ClassificationConfig,
    scope: RunScope = "unclassified",
    maximum: int | None = None,
    run_kind: str = "production",
    selection: dict[str, Any] | None = None,
    api_key: str | None = None,
) -> dict[str, Any]:
    email_ids = select_email_ids(database, account_id, scope=scope, maximum=maximum)
    run = create_classification_run(
        database,
        {
            "gmail_account_id": account_id,
            "classifier_version_id": classifier_version_id,
            "run_kind": run_kind,
            "model_requested": config.model,
            "selection": {"scope": scope, "maximum": maximum, **(selection or {})},
            "minimum_top_probability": config.minimum_top_probability,
            "concurrency": config.concurrency,
            "batch_size": config.batch_size,
        },
    )
    enqueue_classification_emails(database, str(run["id"]), email_ids)
    return run_classification(database, run_id=str(run["id"]), config=config, api_key=api_key)
