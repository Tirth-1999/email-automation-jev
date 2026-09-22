"""Human-review sample creation command."""

from __future__ import annotations

import argparse

from dotenv import load_dotenv

from ..labeling_sample import LABEL_CATEGORIES, select_labeling_sample
from ..labeling_store import read_all_active_emails, to_review_email, write_private_json
from ..repository import create_database_client
from .common import PROJECT_ROOT, required_environment, utc_now


def sample() -> None:
    """Create the initial private, duplicate-free human-review pool."""
    load_dotenv()
    parser = argparse.ArgumentParser(description="Create a human-review email sample")
    parser.add_argument("--count", type=int, default=150)
    parser.add_argument("--body-chars", type=int, default=20_000)
    parser.add_argument("--seed", default="phase-2-ui-sample-v2")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    output = PROJECT_ROOT / "data/labeling/generated/email-review-pool.json"
    if output.exists() and not args.force:
        raise ValueError("Review pool exists. Use the UI Add emails button to preserve reviews.")

    database = create_database_client(
        required_environment("SUPABASE_URL"),
        required_environment("SUPABASE_SERVICE_ROLE_KEY"),
    )
    emails = read_all_active_emails(
        database, lambda seen, total: print(f"Scanned {seen}/{total or '?'} emails")
    )
    selected = select_labeling_sample(emails, args.count, args.seed)
    batch_id, timestamp = f"initial-{args.seed}", utc_now()
    review = [
        to_review_email(email, index, batch_id, str(email["selection_reason"]), args.body_chars)
        for index, email in enumerate(selected, 1)
    ]
    write_private_json(
        output,
        {
            "version": 3,
            "created_at": timestamp,
            "updated_at": timestamp,
            "source_email_count": len(emails),
            "categories": list(LABEL_CATEGORIES),
            "batches": [{"id": batch_id, "created_at": timestamp, "count": len(review), "strategy": "initial"}],
            "emails": review,
        },
    )
    print(f"Created {len(review)}-email private review pool")
