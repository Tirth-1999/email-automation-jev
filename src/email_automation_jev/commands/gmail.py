"""Gmail OAuth, ingestion, and inspection commands."""

from __future__ import annotations

import argparse
import json
from typing import Any, cast

from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow

from ..config import load_ingestion_config, load_oauth_config
from ..gmail_client import GMAIL_READONLY_SCOPE, create_gmail_client, get_gmail_profile
from ..gmail_rate_limit import GmailRequestController
from ..ingestion import run_ingestion
from ..labeling_store import write_private_json
from ..repository import create_database_client, ensure_gmail_account
from .common import PROJECT_ROOT, required_environment


def authorize() -> None:
    """Run Google's local OAuth flow and store a read-only refresh token."""
    load_dotenv()
    oauth = load_oauth_config()
    client_config = {
        "installed": {
            "client_id": oauth.client_id,
            "client_secret": oauth.client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [oauth.redirect_uri],
        }
    }
    flow = InstalledAppFlow.from_client_config(client_config, [GMAIL_READONLY_SCOPE])
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
    write_private_json(PROJECT_ROOT / ".gmail-token.json", {"refresh_token": credentials.refresh_token})
    print("Gmail connected; refresh token saved to .gmail-token.json")


def ingest() -> None:
    """Import Gmail changes into Supabase, or reconcile the complete mailbox."""
    parser = argparse.ArgumentParser(description="Synchronize Gmail with Supabase")
    parser.add_argument("--limit", type=int, help="Optional maximum messages for a full sync")
    parser.add_argument("--full", action="store_true", help="Run paginated mailbox discovery")
    parser.add_argument("--resume", action="store_true", help="Skip messages already in Supabase")
    args = parser.parse_args()
    if args.resume and not args.full:
        raise ValueError("--resume must be used with --full")

    config = load_ingestion_config()
    gmail = create_gmail_client(config.oauth, config.refresh_token)
    requests = GmailRequestController(
        requests_per_second=config.requests_per_second,
        max_retries=config.max_retries,
        on_retry=lambda notice: print(
            f"Gmail throttled {notice.operation}; retry {notice.attempt}/"
            f"{notice.max_retries} in {notice.delay_seconds:.0f}s: {notice.reason}"
        ),
    )
    database = create_database_client(config.supabase_url, config.supabase_service_role_key)
    print("Reading Gmail profile...")
    profile = get_gmail_profile(gmail, requests)
    account = ensure_gmail_account(database, profile["email_address"])
    result = run_ingestion(
        database=database,
        gmail=gmail,
        requests=requests,
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
    print(json.dumps({"type": result.sync_type, **vars(result.counts), "history_id": result.history_id}, indent=2))


def inspect() -> None:
    """Print the newest active messages stored in Supabase."""
    load_dotenv()
    database = create_database_client(
        required_environment("SUPABASE_URL"),
        required_environment("SUPABASE_SERVICE_ROLE_KEY"),
    )
    response = (
        database.table("emails")
        .select("gmail_message_id,internal_date,from_email,subject,gmail_thread_id", count=cast(Any, "exact"))
        .is_("deleted_at", "null")
        .order("internal_date", desc=True)
        .limit(20)
        .execute()
    )
    print(f"Active messages: {response.count}")
    print(json.dumps(response.data, indent=2))
