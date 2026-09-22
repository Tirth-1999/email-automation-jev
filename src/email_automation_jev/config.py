from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


def positive_int(name: str, fallback: int) -> int:
    raw = os.getenv(name, "").strip()
    value = int(raw) if raw else fallback
    if value <= 0:
        raise ValueError(f"{name} must be a positive integer")
    return value


def non_negative_int(name: str, fallback: int) -> int:
    raw = os.getenv(name, "").strip()
    value = int(raw) if raw else fallback
    if value < 0:
        raise ValueError(f"{name} must be a non-negative integer")
    return value


def positive_float(name: str, fallback: float) -> float:
    raw = os.getenv(name, "").strip()
    value = float(raw) if raw else fallback
    if value <= 0:
        raise ValueError(f"{name} must be a positive number")
    return value


def boolean(name: str, fallback: bool) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return fallback
    if raw in {"true", "1", "yes"}:
        return True
    if raw in {"false", "0", "no"}:
        return False
    raise ValueError(f"{name} must be true or false")


@dataclass(frozen=True)
class OAuthConfig:
    client_id: str
    client_secret: str
    redirect_uri: str


@dataclass(frozen=True)
class IngestionConfig:
    supabase_url: str
    supabase_service_role_key: str
    oauth: OAuthConfig
    refresh_token: str
    gmail_query: str
    include_spam_trash: bool
    include_outgoing: bool
    max_messages: int
    fetch_concurrency: int
    requests_per_second: float
    max_retries: int
    upsert_batch_size: int


def load_oauth_config() -> OAuthConfig:
    return OAuthConfig(
        client_id=required("GMAIL_CLIENT_ID"),
        client_secret=required("GMAIL_CLIENT_SECRET"),
        redirect_uri=os.getenv("GMAIL_REDIRECT_URI", "").strip() or "http://localhost:3000/oauth2callback",
    )


def load_refresh_token(project_root: Path | None = None) -> str:
    environment_token = os.getenv("GMAIL_REFRESH_TOKEN", "").strip()
    if environment_token:
        return environment_token
    token_path = (project_root or Path.cwd()) / ".gmail-token.json"
    try:
        token = json.loads(token_path.read_text())
    except FileNotFoundError as error:
        raise ValueError("No Gmail refresh token found. Run `uv run email-gmail-auth` or set GMAIL_REFRESH_TOKEN.") from error
    value = str(token.get("refresh_token", "")).strip()
    if not value:
        raise ValueError(f"{token_path} does not contain a refresh_token")
    return value


def load_ingestion_config() -> IngestionConfig:
    return IngestionConfig(
        supabase_url=required("SUPABASE_URL"),
        supabase_service_role_key=required("SUPABASE_SERVICE_ROLE_KEY"),
        oauth=load_oauth_config(),
        refresh_token=load_refresh_token(),
        gmail_query=os.getenv("GMAIL_QUERY", "").strip() or "-in:drafts",
        include_spam_trash=boolean("GMAIL_INCLUDE_SPAM_TRASH", True),
        include_outgoing=boolean("GMAIL_INCLUDE_OUTGOING", True),
        max_messages=non_negative_int("GMAIL_MAX_MESSAGES", 0),
        fetch_concurrency=positive_int("GMAIL_FETCH_CONCURRENCY", 2),
        requests_per_second=positive_float("GMAIL_REQUESTS_PER_SECOND", 2),
        max_retries=non_negative_int("GMAIL_MAX_RETRIES", 8),
        upsert_batch_size=positive_int("GMAIL_UPSERT_BATCH_SIZE", 100),
    )
