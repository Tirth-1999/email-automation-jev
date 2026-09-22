"""Backward-compatible aliases for console scripts from earlier releases.

New code should import the focused modules under :mod:`email_automation_jev.commands`
or use the repository-level ``manage.py`` launcher.
"""

from .commands.classify import run as phase6_classify
from .commands.evaluation import evaluate as evaluate_jev
from .commands.evaluation import prepare as prepare_jev_eval
from .commands.gmail import authorize as gmail_auth
from .commands.gmail import ingest
from .commands.gmail import inspect as inspect_emails
from .commands.labeling import sample as sample_emails
from .commands.storage import bootstrap as bootstrap_classification_data

__all__ = [
    "bootstrap_classification_data",
    "evaluate_jev",
    "gmail_auth",
    "ingest",
    "inspect_emails",
    "phase6_classify",
    "prepare_jev_eval",
    "sample_emails",
]
