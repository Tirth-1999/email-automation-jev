from __future__ import annotations

import hashlib
from typing import Any

HUMAN_CATEGORIES = {
    "applied",
    "outreach",
    "reply_needed",
    "interview_assessment",
    "offer",
    "rejected",
    "other",
    "uncertain",
}


def human_dataset_version(emails: list[dict[str, Any]]) -> str:
    canonical = "\n".join(sorted(f"{email['email_id']}\t{email['manual_label']}\t{email['labeled_at']}" for email in emails))
    return f"sha256:{hashlib.sha256(canonical.encode()).hexdigest()}"


def human_label_import_rows(emails: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for email in emails:
        if email["manual_label"] not in HUMAN_CATEGORIES:
            raise ValueError(f"Invalid human category for {email['email_id']}: {email['manual_label']}")
        result.append(
            {
                "email_id": email["email_id"],
                "source_key": f"initial-json:{email['email_id']}:{email['labeled_at']}",
                "category": email["manual_label"],
                "source": "review_ui",
                "reviewer_label": "initial-json-import",
                "notes": email.get("review_notes", ""),
            }
        )
    return result


def benchmark_summary(report: dict[str, Any]) -> dict[str, Any]:
    keys = (
        "generated_at",
        "evaluation_scope",
        "model_requested",
        "model_returned",
        "minimum_top_probability",
        "metrics",
        "per_category",
        "confusion_matrix",
    )
    return {key: report.get(key) for key in keys}
