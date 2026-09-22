"""Run and resume durable production Jev classification batches."""

from __future__ import annotations

import argparse
import json
import os
from typing import Any, cast

from dotenv import load_dotenv

from ..classification_repository import (
    create_classification_run,
    enqueue_classification_emails,
    find_classifier_version,
)
from ..classification_worker import ClassificationConfig, run_classification, select_email_ids
from ..jev_classifier import CLASSIFIER_VERSION
from ..repository import create_database_client
from .common import required_environment


def run() -> None:
    """Create a production run or resume an existing run by its identifier."""
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scope", choices=("all", "unclassified", "uncertain", "failed"), default="unclassified")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--concurrency", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=25)
    parser.add_argument("--threshold", type=float, default=float(os.getenv("JEV_MIN_TOP_PROBABILITY", "0.6")))
    parser.add_argument("--model", default=os.getenv("TYPESAFE_MODEL", "jev-1.13.0"))
    parser.add_argument("--run-id", help="Resume queued work for an existing run")
    args = parser.parse_args()
    database = create_database_client(
        required_environment("SUPABASE_URL"),
        required_environment("SUPABASE_SERVICE_ROLE_KEY"),
    )
    config = ClassificationConfig(
        model=args.model,
        minimum_top_probability=args.threshold,
        concurrency=args.concurrency,
        batch_size=args.batch_size,
    )
    if args.run_id:
        result = run_classification(
            database,
            run_id=args.run_id,
            config=config,
            api_key=required_environment("TYPESAFE_API_KEY"),
        )
    else:
        account_rows = cast(
            list[dict[str, Any]],
            database.table("gmail_accounts").select("id").order("created_at").limit(1).execute().data or [],
        )
        if not account_rows:
            raise ValueError("No Gmail account is registered. Run ingestion first.")
        classifier = find_classifier_version(database, CLASSIFIER_VERSION)
        if not classifier or classifier.get("status") != "approved":
            raise ValueError(f"Approved classifier {CLASSIFIER_VERSION} is required")
        email_ids = select_email_ids(database, account_rows[0]["id"], scope=args.scope, maximum=args.limit)
        classification_run = create_classification_run(
            database,
            {
                "gmail_account_id": account_rows[0]["id"],
                "classifier_version_id": classifier["id"],
                "run_kind": "production",
                "model_requested": config.model,
                "selection": {"scope": args.scope, "maximum": args.limit},
                "minimum_top_probability": config.minimum_top_probability,
                "concurrency": config.concurrency,
                "batch_size": config.batch_size,
            },
        )
        enqueue_classification_emails(database, str(classification_run["id"]), email_ids)
        print(json.dumps({"run_id": classification_run["id"], "queued_email_count": len(email_ids)}, indent=2))
        result = run_classification(
            database,
            run_id=str(classification_run["id"]),
            config=config,
            api_key=required_environment("TYPESAFE_API_KEY"),
        )
    print(json.dumps(result, indent=2, default=str))
