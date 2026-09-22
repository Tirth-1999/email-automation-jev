from __future__ import annotations

import argparse
import hashlib
import json
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow
from typesafe_sdk import TypeSafeClient

from .classification_bootstrap import (
    benchmark_summary,
    human_dataset_version,
    human_label_import_rows,
)
from .classification_repository import (
    approve_classifier_version,
    create_classifier_version,
    find_classifier_version,
)
from .config import load_ingestion_config, load_oauth_config
from .gmail_client import GMAIL_READONLY_SCOPE, create_gmail_client, get_gmail_profile
from .gmail_rate_limit import GmailRequestController
from .ingestion import run_ingestion
from .jev_classifier import (
    CLASSIFIER_QUESTIONS,
    CLASSIFIER_VERSION,
    JEV_CATEGORIES,
    classify_email_with_jev,
)
from .labeling_sample import LABEL_CATEGORIES, select_labeling_sample
from .labeling_store import read_all_active_emails, read_json, to_review_email, write_private_json
from .repository import create_database_client, ensure_gmail_account

ROOT = Path.cwd()


def required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


def now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def gmail_auth() -> None:
    load_dotenv()
    oauth = load_oauth_config()
    config = {
        "installed": {
            "client_id": oauth.client_id,
            "client_secret": oauth.client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [oauth.redirect_uri],
        }
    }
    flow = InstalledAppFlow.from_client_config(config, [GMAIL_READONLY_SCOPE])
    port = int(oauth.redirect_uri.rsplit(":", 1)[-1].split("/")[0])
    credentials = flow.run_local_server(
        host="127.0.0.1",
        port=port,
        authorization_prompt_message="Open this URL in your browser:\n{url}",
        prompt="consent",
        access_type="offline",
    )
    if not credentials.refresh_token:
        raise RuntimeError("Google did not return a refresh token. Revoke the app grant and try again.")
    write_private_json(ROOT / ".gmail-token.json", {"refresh_token": credentials.refresh_token})
    print("Gmail connected; refresh token saved to .gmail-token.json")


def ingest() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int)
    parser.add_argument("--full", action="store_true")
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()
    if args.resume and not args.full:
        raise ValueError("--resume must be used with --full")
    config = load_ingestion_config()
    gmail = create_gmail_client(config.oauth, config.refresh_token)
    controller = GmailRequestController(
        requests_per_second=config.requests_per_second,
        max_retries=config.max_retries,
        on_retry=lambda notice: print(
            f"Gmail throttled {notice.operation}; retry {notice.attempt}/{notice.max_retries} in {notice.delay_seconds:.0f}s: {notice.reason}"
        ),
    )
    database = create_database_client(config.supabase_url, config.supabase_service_role_key)
    print("Reading Gmail profile...")
    profile = get_gmail_profile(gmail, controller)
    account = ensure_gmail_account(database, profile["email_address"])
    result = run_ingestion(
        database=database,
        gmail=gmail,
        requests=controller,
        account=account,
        profile_history_id=profile["history_id"],
        force_full=args.full,
        resume_full=args.resume,
        query=config.gmail_query,
        include_spam_trash=config.include_spam_trash,
        include_outgoing=config.include_outgoing,
        max_messages=args.limit or config.max_messages,
        fetch_concurrency=config.fetch_concurrency,
        upsert_batch_size=config.upsert_batch_size,
        on_progress=lambda message, stats=None: print(message),
    )
    print(
        json.dumps(
            {"type": result.sync_type, **vars(result.counts), "history_id": result.history_id},
            indent=2,
        )
    )


def inspect_emails() -> None:
    load_dotenv()
    database = create_database_client(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"))
    response = (
        database.table("emails")
        .select("gmail_message_id,internal_date,from_email,subject,gmail_thread_id", count="exact")
        .is_("deleted_at", "null")
        .order("internal_date", desc=True)
        .limit(20)
        .execute()
    )
    print(f"Active messages: {response.count}")
    print(json.dumps(response.data, indent=2))


def sample_emails() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=150)
    parser.add_argument("--body-chars", type=int, default=20_000)
    parser.add_argument("--seed", default="phase-2-ui-sample-v2")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    output = ROOT / "data/labeling/generated/email-review-pool.json"
    if output.exists() and not args.force:
        raise ValueError("Review pool exists. Use the UI Add emails button to preserve reviews.")
    database = create_database_client(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"))
    emails = read_all_active_emails(database, lambda seen, total: print(f"Scanned {seen}/{total or '?'} emails"))
    selected = select_labeling_sample(emails, args.count, args.seed)
    batch_id, timestamp = f"initial-{args.seed}", now()
    review = [to_review_email(email, index, batch_id, str(email["selection_reason"]), args.body_chars) for index, email in enumerate(selected, 1)]
    write_private_json(
        output,
        {
            "version": 3,
            "created_at": timestamp,
            "updated_at": timestamp,
            "source_email_count": len(emails),
            "categories": list(LABEL_CATEGORIES),
            "batches": [
                {
                    "id": batch_id,
                    "created_at": timestamp,
                    "count": len(review),
                    "strategy": "initial",
                }
            ],
            "emails": review,
        },
    )
    print(f"Created {len(review)}-email private review pool")


def prepare_jev_eval() -> None:
    source = read_json(ROOT / "data/labeling/generated/labeled-emails.json")
    seed, development, evaluation, distribution = "jev-evaluation-v1", [], [], {}
    manual = [email for email in source["emails"] if email["manual_label"] == "uncertain"]
    for category in JEV_CATEGORIES:
        rows = sorted(
            (email for email in source["emails"] if email["manual_label"] == category),
            key=lambda email: hashlib.sha256(f"{seed}:{email['email_id']}".encode()).hexdigest(),
        )
        count = max(1, round(len(rows) * 0.2)) if len(rows) >= 5 else 0
        evaluation += rows[:count]
        development += rows[count:]
        distribution[category] = {
            "total": len(rows),
            "development": len(rows) - count,
            "evaluation": count,
        }
    metadata = {
        "version": 1,
        "generated_at": now(),
        "source": "labeled-emails.json",
        "seed": seed,
        "split_policy": "Per-category deterministic 20% holdout when a category has at least 5 examples; rarer categories remain in development.",
        "distribution": distribution,
        "manual_review_count": len(manual),
        "warnings": [],
    }
    out = ROOT / "data/labeling/generated"
    for name, split, emails in (
        ("jev-development.json", "development", development),
        ("jev-evaluation.json", "evaluation", evaluation),
        ("jev-manual-review.json", "manual_review", manual),
    ):
        write_private_json(out / name, {**metadata, "split": split, "emails": emails})
    write_private_json(out / "jev-prep-report.json", metadata)
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


def evaluate_jev() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser()
    parser.add_argument("--all-labeled", action="store_true")
    args = parser.parse_args()
    required("TYPESAFE_API_KEY")
    model = os.getenv("TYPESAFE_MODEL", "jev-1.13.0")
    threshold = float(os.getenv("JEV_MIN_TOP_PROBABILITY", ".6"))
    concurrency = int(os.getenv("JEV_EVAL_CONCURRENCY", "5"))
    filename = "labeled-emails.json" if args.all_labeled else "jev-evaluation.json"
    emails = [email for email in read_json(ROOT / "data/labeling/generated" / filename)["emails"] if email["manual_label"] in JEV_CATEGORIES]
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
    correct_auto = [row for row in automatic if row["decision"] == row["expected"]]
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
    matrix = {
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
        "generated_at": now(),
        "model_requested": model,
        "model_returned": sorted({row["model"] for row in results}),
        "minimum_top_probability": threshold,
        "metrics": {
            "examples": len(results),
            "raw_accuracy": len(correct) / len(results) if results else 0,
            "automatic_coverage": len(automatic) / len(results) if results else 0,
            "automatic_accuracy": len(correct_auto) / len(automatic) if automatic else 0,
            "total_input_tokens": sum(row["input_tokens"] for row in results),
        },
        "per_category": per_category,
        "confusion_matrix": matrix,
        "results": results,
    }
    output = "jev-all-labeled-results.json" if args.all_labeled else "jev-evaluation-results.json"
    write_private_json(ROOT / "data/labeling/generated" / output, report)
    print(json.dumps(report["metrics"], indent=2))


def bootstrap_classification_data() -> None:
    load_dotenv()
    labels = read_json(ROOT / "data/labeling/generated/labeled-emails.json")
    benchmark = read_json(ROOT / "data/labeling/generated/jev-evaluation-results.json")
    if benchmark.get("classifier_version") != CLASSIFIER_VERSION:
        raise ValueError("Held-out benchmark classifier version is stale")
    database = create_database_client(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"))
    rows = human_label_import_rows(labels["emails"])
    database.table("email_human_label_events").upsert(rows, on_conflict="source_key", ignore_duplicates=True).execute()
    classifier = find_classifier_version(database, CLASSIFIER_VERSION)
    if not classifier:
        classifier = create_classifier_version(
            database,
            {
                "version": CLASSIFIER_VERSION,
                "model_requested": benchmark.get("model_requested", os.getenv("TYPESAFE_MODEL", "jev-latest")),
                "question_config": {key: value.model_dump() for key, value in CLASSIFIER_QUESTIONS.items()},
                "composition_policy": {
                    "uncertain_when_top_probability_below": benchmark.get("minimum_top_probability", 0.6),
                    "draft_requires_category": "reply_needed",
                    "draft_probability_threshold": float(os.getenv("JEV_DRAFT_REPLY_THRESHOLD", ".65")),
                },
                "source_dataset_version": human_dataset_version(labels["emails"]),
                "reference_config": {
                    "strategy": "structured-criteria",
                    "held_out_examples_in_prompt": False,
                },
            },
        )
    if classifier["status"] == "draft":
        classifier = approve_classifier_version(database, classifier["id"], benchmark_summary(benchmark))
    print(
        json.dumps(
            {
                "human_labels_total": len(rows),
                "classifier_version": classifier["version"],
                "classifier_status": classifier["status"],
            },
            indent=2,
        )
    )
