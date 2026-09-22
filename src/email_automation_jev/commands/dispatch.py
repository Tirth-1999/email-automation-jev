"""Dispatch all project commands through one documented interface."""

from __future__ import annotations

import argparse
import os
import sys
from collections.abc import Callable

from ..dashboard import main as dashboard
from .classify import run as classify
from .evaluation import evaluate as jev_evaluate
from .evaluation import prepare as jev_prepare
from .gmail import authorize as gmail_auth
from .gmail import ingest
from .gmail import inspect as inspect_emails
from .labeling import sample
from .storage import bootstrap as phase5_bootstrap

Command = Callable[[], None]

COMMANDS: dict[str, tuple[Command, str]] = {
    "gmail-auth": (gmail_auth, "Authorize Gmail and save a local refresh token."),
    "ingest": (ingest, "Ingest Gmail messages into Supabase."),
    "inspect": (inspect_emails, "Print a summary and the 20 newest stored emails."),
    "sample": (sample, "Create a private email pool for manual review."),
    "dashboard": (dashboard, "Start the local review and command-center dashboard."),
    "jev-prepare": (jev_prepare, "Prepare deterministic Jev development and evaluation splits."),
    "jev-evaluate": (jev_evaluate, "Benchmark Jev on human-labelled emails."),
    "phase5-bootstrap": (phase5_bootstrap, "Import labels and classifier metadata into Supabase."),
    "classify": (classify, "Run or resume production Jev classification."),
}


def build_parser() -> argparse.ArgumentParser:
    """Build the top-level parser without consuming command-specific flags."""
    command_help = "\n".join(f"  {name:<18} {description}" for name, (_, description) in COMMANDS.items())
    parser = argparse.ArgumentParser(
        prog=os.getenv("EMAIL_AUTOMATION_PROG", "python manage.py"),
        description="Email Automation Jev project command center",
        epilog=f"commands:\n{command_help}\n\nRun '{os.getenv('EMAIL_AUTOMATION_PROG', 'python manage.py')} COMMAND --help' for command options.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    return parser


def main() -> None:
    """Select one command, then let that command parse its own remaining flags."""
    parser = build_parser()
    if len(sys.argv) == 1 or sys.argv[1] in {"-h", "--help"}:
        parser.print_help()
        return
    command_name = sys.argv[1]
    if command_name not in COMMANDS:
        parser.error(f"unknown command: {command_name}")
    command, _description = COMMANDS[command_name]
    program = os.getenv("EMAIL_AUTOMATION_PROG", "python manage.py")
    sys.argv = [f"{program} {command_name}", *sys.argv[2:]]
    command()
