"""Prepare human-labelled data and benchmark the Jev classifier."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from dotenv import load_dotenv
from typesafe_sdk import TypeSafeClient

from ..jev_classifier import CLASSIFIER_VERSION, JEV_CATEGORIES, classify_email_with_jev
from ..labeling_store import read_json, write_private_json
from .common import PROJECT_ROOT, required_environment, utc_now


def prepare() -> None:
    """Create deterministic development, evaluation, and manual-review splits."""
    source = read_json(PROJECT_ROOT / "data/labeling/generated/labeled-emails.json")
    seed = "jev-evaluation-v1"
    development: list[dict[str, Any]] = []
    evaluation: list[dict[str, Any]] = []
    distribution: dict[str, dict[str, int]] = {}
    manual = [email for email in source["emails"] if email["manual_label"] == "uncertain"]

    for category in JEV_CATEGORIES:
        rows = sorted(
            (email for email in source["emails"] if email["manual_label"] == category),
            key=lambda email: hashlib.sha256(f"{seed}:{email['email_id']}".encode()).hexdigest(),
        )
        count = max(1, round(len(rows) * 0.2)) if len(rows) >= 5 else 0
        evaluation.extend(rows[:count])
        development.extend(rows[count:])
        distribution[category] = {
            "total": len(rows),
            "development": len(rows) - count,
            "evaluation": count,
        }

    metadata = {
        "version": 1,
        "generated_at": utc_now(),
        "source": "labeled-emails.json",
        "seed": seed,
        "split_policy": "Per-category deterministic 20% holdout when a category has at least 5 examples; rarer categories remain in development.",
        "distribution": distribution,
        "manual_review_count": len(manual),
        "warnings": [],
    }
    output_directory = PROJECT_ROOT / "data/labeling/generated"
    for filename, split, emails in (
        ("jev-development.json", "development", development),
        ("jev-evaluation.json", "evaluation", evaluation),
        ("jev-manual-review.json", "manual_review", manual),
    ):
        write_private_json(output_directory / filename, {**metadata, "split": split, "emails": emails})
    write_private_json(output_directory / "jev-prep-report.json", metadata)
    print(
        json.dumps(
            {
                "labeled": len(source["emails"]),
                "development": len(development),
                "evaluation": len(evaluation),
                "manual_review": len(manual),
            },
            indent=2,
        )
    )


def evaluate() -> None:
    """Run Jev against either the held-out split or every labelled email."""
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--all-labeled", action="store_true")
    args = parser.parse_args()
    required_environment("TYPESAFE_API_KEY")
    model = os.getenv("TYPESAFE_MODEL", "jev-1.13.0")
    threshold = float(os.getenv("JEV_MIN_TOP_PROBABILITY", ".6"))
    concurrency = int(os.getenv("JEV_EVAL_CONCURRENCY", "5"))
    filename = "labeled-emails.json" if args.all_labeled else "jev-evaluation.json"
    emails = [
        email
        for email in read_json(PROJECT_ROOT / "data/labeling/generated" / filename)["emails"]
        if email["manual_label"] in JEV_CATEGORIES
    ]
    client = TypeSafeClient(model=model, timeout=30)

    def classify(email: dict[str, Any]) -> dict[str, Any]:
        result = classify_email_with_jev(client, email, model=model, minimum_top_probability=threshold)
        return {
            "email_id": email["email_id"],
            "subject": email["subject"],
            "sender": email["from_email"],
            "direction": email["direction"],
            "expected": email["manual_label"],
            **vars(result),
        }

    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        results = list(pool.map(classify, emails))
    automatic = [row for row in results if row["decision"] != "uncertain"]
    correct = [row for row in results if row["category"] == row["expected"]]
    correct_automatic = [row for row in automatic if row["decision"] == row["expected"]]
    per_category = {}
    for category in JEV_CATEGORIES:
        rows = [row for row in results if row["expected"] == category]
        category_correct = [row for row in rows if row["category"] == category]
        per_category[category] = {
            "count": len(rows),
            "correct": len(category_correct),
            "uncertain": len([row for row in rows if row["decision"] == "uncertain"]),
            "accuracy": len(category_correct) / len(rows) if rows else None,
        }
    confusion_matrix = {
        expected: {
            predicted: len([row for row in results if row["expected"] == expected and row["decision"] == predicted])
            for predicted in (*JEV_CATEGORIES, "uncertain")
        }
        for expected in JEV_CATEGORIES
    }
    report = {
        "version": 2,
        "classifier_version": CLASSIFIER_VERSION,
        "evaluation_scope": "all classifiable human labels; diagnostic" if args.all_labeled else "untouched held-out set",
        "generated_at": utc_now(),
        "model_requested": model,
        "model_returned": sorted({row["model"] for row in results}),
        "minimum_top_probability": threshold,
        "metrics": {
            "examples": len(results),
            "raw_accuracy": len(correct) / len(results) if results else 0,
            "automatic_coverage": len(automatic) / len(results) if results else 0,
            "automatic_accuracy": len(correct_automatic) / len(automatic) if automatic else 0,
            "total_input_tokens": sum(row["input_tokens"] for row in results),
        },
        "per_category": per_category,
        "confusion_matrix": confusion_matrix,
        "results": results,
    }
    output = "jev-all-labeled-results.json" if args.all_labeled else "jev-evaluation-results.json"
    write_private_json(PROJECT_ROOT / "data/labeling/generated" / output, report)
    print(json.dumps(report["metrics"], indent=2))
