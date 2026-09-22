"""Regression tests for the repository-native command launcher."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def run_manage(*arguments: str) -> subprocess.CompletedProcess[str]:
    """Run manage.py in a clean child interpreter without setting PYTHONPATH."""
    return subprocess.run(
        [sys.executable, str(PROJECT_ROOT / "manage.py"), *arguments],
        cwd=PROJECT_ROOT.parent,
        check=False,
        capture_output=True,
        text=True,
    )


def test_top_level_help_loads_source_package_without_install_metadata() -> None:
    result = run_manage("--help")

    assert result.returncode == 0
    assert "Email Automation Jev project command center" in result.stdout
    assert "classify" in result.stdout


def test_command_help_is_forwarded_to_selected_command() -> None:
    result = run_manage("ingest", "--help")

    assert result.returncode == 0
    assert "Synchronize Gmail with Supabase" in result.stdout
    assert "--resume" in result.stdout


def test_unknown_command_has_a_clear_error() -> None:
    result = run_manage("not-a-command")

    assert result.returncode == 2
    assert "unknown command: not-a-command" in result.stderr
