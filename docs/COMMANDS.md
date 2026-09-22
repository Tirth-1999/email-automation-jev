# Command runbook

Run every command from the repository root. The canonical form is:

```bash
./email COMMAND [OPTIONS]
```

After the one-time setup, use `./email ...`. This launcher selects the repository's virtual environment and loads `src/email_automation_jev` for you.

## Setup and verification

```bash
uv sync --extra dev --no-editable
./email --help
.venv/bin/pytest
.venv/bin/ruff check .
.venv/bin/mypy src
```

## Phase commands

| Operation | Command | Result |
| --- | --- | --- |
| Connect Gmail | `./email gmail-auth` | Saves the read-only refresh token to `.gmail-token.json`. |
| Incremental ingestion | `./email ingest` | Reads changes since the stored Gmail history ID. |
| Full discovery | `./email ingest --full` | Paginates the selected mailbox scope. |
| Resume full discovery | `./email ingest --full --resume` | Skips Gmail message IDs already stored in Supabase. |
| Inspect storage | `./email inspect` | Prints the active count and 20 newest messages. |
| Build review pool | `./email sample --count 150` | Creates the private, duplicate-free manual-review pool. |
| Start dashboard | `./email dashboard` | Serves the UI at `http://127.0.0.1:4173`. |
| Prepare evaluation | `./email jev-prepare` | Rebuilds deterministic development and holdout datasets. |
| Held-out benchmark | `./email jev-evaluate` | Evaluates the production classifier on the holdout set. |
| Diagnostic benchmark | `./email jev-evaluate --all-labeled` | Evaluates all definitive human labels. |
| Bootstrap Phase 5 | `./email phase5-bootstrap` | Imports label events and registers the approved classifier. |
| Controlled classification | `./email classify --scope unclassified --limit 25` | Runs a bounded production batch. |
| Resume classification | `./email classify --run-id RUN_UUID` | Continues queued work without selecting new emails. |

Use `./email COMMAND --help` for the flags owned by an individual command.

## Fixing `ModuleNotFoundError`

The checkout path contains spaces, which can prevent Python from loading an editable install's `.pth` entry. Install the package non-editably and use the repository launcher:

```bash
uv sync --extra dev --no-editable
./email ingest
```

This also rebuilds `.venv/bin/email-ingest` and the other compatibility aliases. If the virtual environment itself is incomplete, rebuild only that generated environment, then sync again. Gmail data, Supabase data, `.env`, local tokens, and human-label JSON files are outside the virtual environment and are not recreated by this procedure.
