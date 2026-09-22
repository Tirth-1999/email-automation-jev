"""Bootstrap human labels and the approved classifier version in Supabase."""

from __future__ import annotations

import json
import os

from dotenv import load_dotenv

from ..classification_bootstrap import benchmark_summary, human_dataset_version, human_label_import_rows
from ..classification_repository import approve_classifier_version, create_classifier_version, find_classifier_version
from ..jev_classifier import CLASSIFIER_QUESTIONS, CLASSIFIER_VERSION
from ..labeling_store import read_json
from ..repository import create_database_client
from .common import PROJECT_ROOT, required_environment


def bootstrap() -> None:
    """Import reviewed labels and register the held-out benchmark in Supabase."""
    load_dotenv()
    labels = read_json(PROJECT_ROOT / "data/labeling/generated/labeled-emails.json")
    benchmark = read_json(PROJECT_ROOT / "data/labeling/generated/jev-evaluation-results.json")
    if benchmark.get("classifier_version") != CLASSIFIER_VERSION:
        raise ValueError("Held-out benchmark classifier version is stale")
    database = create_database_client(
        required_environment("SUPABASE_URL"),
        required_environment("SUPABASE_SERVICE_ROLE_KEY"),
    )
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
