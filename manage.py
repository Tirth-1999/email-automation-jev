#!/usr/bin/env python3
"""Reliable repository launcher for every Email Automation Jev command.

This file deliberately adds the repository's ``src`` directory to Python's
module search path. It therefore works from a fresh checkout and does not rely
on fragile editable-install metadata in ``.venv/bin``.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
SOURCE_ROOT = PROJECT_ROOT / "src"
sys.path.insert(0, str(SOURCE_ROOT))
os.chdir(PROJECT_ROOT)

from email_automation_jev.commands.dispatch import main  # noqa: E402

if __name__ == "__main__":
    main()
