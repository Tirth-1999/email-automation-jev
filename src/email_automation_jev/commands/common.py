"""Shared helpers for command-line entry points."""

from __future__ import annotations

import os
from datetime import UTC, datetime
from pathlib import Path


def find_project_root() -> Path:
    """Locate the checkout while still allowing commands to run from its subdirectories."""
    candidates = (Path.cwd(), Path(__file__).resolve().parents[3])
    for candidate in candidates:
        if (candidate / "pyproject.toml").is_file() and (candidate / "src/email_automation_jev").is_dir():
            return candidate
    return Path.cwd()


PROJECT_ROOT = find_project_root()


def required_environment(name: str) -> str:
    """Return a required environment variable or raise a useful error."""
    value = os.getenv(name, "").strip()
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


def utc_now() -> str:
    """Return a JSON-friendly UTC timestamp."""
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")
