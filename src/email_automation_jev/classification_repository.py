from __future__ import annotations

import re
from typing import Any

from supabase import Client

from .models import JevClassification
from .repository import utc_now


def sanitized_classification_error(error: BaseException) -> str:
    message = re.sub(r"Bearer\s+\S+", "Bearer [redacted]", str(error), flags=re.I)
    message = re.sub(
        r"(api[_-]?key|token|secret|password)\s*[=:]\s*[^\s,;]+",
        r"\1=[redacted]",
        message,
        flags=re.I,
    )
    return message[:2000]


def create_classifier_version(database: Client, value: dict[str, Any]) -> dict[str, Any]:
    row = {
        **value,
        "reference_config": value.get("reference_config", {}),
        "benchmark_summary": value.get("benchmark_summary"),
    }
    return database.table("classifier_versions").insert(row).execute().data[0]


def find_classifier_version(database: Client, version: str) -> dict[str, Any] | None:
    response = database.table("classifier_versions").select("*").eq("version", version).maybe_single().execute()
    return response.data


def approve_classifier_version(database: Client, version_id: str, summary: dict[str, Any]) -> dict[str, Any]:
    response = (
        database.table("classifier_versions")
        .update({"status": "approved", "benchmark_summary": summary, "approved_at": utc_now()})
        .eq("id", version_id)
        .eq("status", "draft")
        .execute()
    )
    return response.data[0]


def create_classification_run(database: Client, value: dict[str, Any]) -> dict[str, Any]:
    return database.table("classification_runs").insert(value).execute().data[0]


def refresh_classification_run_counters(database: Client, run_id: str) -> None:
    database.rpc("refresh_classification_run_counters", {"p_run_id": run_id}).execute()


def enqueue_classification_emails(database: Client, run_id: str, email_ids: list[str]) -> int:
    rows = [{"run_id": run_id, "email_id": email_id} for email_id in dict.fromkeys(email_ids)]
    if not rows:
        return 0
    response = database.table("email_classification_results").upsert(rows, on_conflict="run_id,email_id", ignore_duplicates=True).execute()
    refresh_classification_run_counters(database, run_id)
    return len(response.data or [])


def mark_classification_running(database: Client, run_id: str, email_id: str) -> None:
    (
        database.table("email_classification_results")
        .update(
            {
                "status": "running",
                "started_at": utc_now(),
                "attempt_count": 1,
                "error_message": None,
            }
        )
        .eq("run_id", run_id)
        .eq("email_id", email_id)
        .eq("status", "queued")
        .execute()
    )


def save_classification_result(database: Client, run_id: str, email_id: str, result: JevClassification) -> None:
    row = {
        "status": "succeeded",
        "category": result.category,
        "category_decision": result.decision,
        "category_confidence": result.confidence,
        "category_top_probability": result.top_probability,
        "category_probabilities": result.probabilities,
        "next_action": result.action["choice"],
        "action_confidence": result.action["confidence"],
        "action_probabilities": result.action["probabilities"],
        "urgency_score": result.urgency["score"],
        "urgency_confidence": result.urgency["confidence"],
        "urgency_probabilities": result.urgency["probabilities"],
        "draft_probability": result.draft_reply["probability"],
        "should_draft": result.draft_reply["should_draft"],
        "model_returned": result.model,
        "input_tokens": result.input_tokens,
        "error_message": None,
        "classified_at": utc_now(),
    }
    (database.table("email_classification_results").update(row).eq("run_id", run_id).eq("email_id", email_id).eq("status", "running").execute())


def fail_classification_result(database: Client, run_id: str, email_id: str, error: BaseException) -> None:
    row = {
        "status": "failed",
        "error_message": sanitized_classification_error(error),
        "classified_at": utc_now(),
    }
    (database.table("email_classification_results").update(row).eq("run_id", run_id).eq("email_id", email_id).eq("status", "running").execute())


def request_classification_cancellation(database: Client, run_id: str) -> None:
    database.table("classification_runs").update({"cancellation_requested_at": utc_now()}).eq("id", run_id).in_("status", ["queued", "running"]).execute()


def append_human_label_event(database: Client, value: dict[str, Any]) -> dict[str, Any]:
    defaults = {
        "source_key": None,
        "category": None,
        "next_action": None,
        "urgency_level": None,
        "draft_needed": None,
        "reviewer_id": None,
        "reviewer_label": None,
        "notes": "",
        "supersedes_event_id": None,
    }
    return database.table("email_human_label_events").insert({**defaults, **value}).execute().data[0]


def create_classification_review_case(database: Client, value: dict[str, Any]) -> dict[str, Any]:
    return database.table("classification_review_cases").insert({"classification_result_id": None, **value}).execute().data[0]


def save_llm_review_suggestion(database: Client, case_id: str, value: dict[str, Any]) -> dict[str, Any]:
    row = {
        "status": "llm_completed",
        "llm_provider": value["provider"],
        "llm_model": value["model"],
        "llm_prompt_version": value["prompt_version"],
        "llm_suggestion": value["suggestion"],
        "llm_input_tokens": value.get("input_tokens"),
        "llm_output_tokens": value.get("output_tokens"),
        "llm_error_message": None,
        "requested_at": utc_now(),
    }
    response = database.table("classification_review_cases").update(row).eq("id", case_id).in_("status", ["pending", "llm_requested"]).execute()
    return response.data[0]
