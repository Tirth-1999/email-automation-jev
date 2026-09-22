# Code architecture

The repository separates user-facing commands from reusable application services. Commands parse input and print results; service modules contain behavior that the CLI, dashboard, and tests can share.

```text
manage.py                         stable repository launcher
src/email_automation_jev/
  commands/                      small command adapters
    gmail.py                     OAuth, ingestion, inspection
    labeling.py                  manual-review sampling
    evaluation.py                Jev preparation and benchmarks
    storage.py                   Phase 5 Supabase bootstrap
    classify.py                  Phase 6 production batches
    dispatch.py                  top-level command routing
  ingestion.py                   synchronization orchestration
  gmail_client.py                Gmail API operations and parsing
  gmail_rate_limit.py            throttling and retry policy
  repository.py                  ingestion persistence
  jev_classifier.py              typed Jev judgments and composition
  classification_worker.py       durable concurrent processing
  classification_repository.py   classification persistence
  dashboard.py                   local HTTP API and static-file server
apps/dashboard/                  framework-free browser UI
supabase/migrations/             versioned database schema
tests/                            unit and integration-boundary tests
```

`src/email_automation_jev/cli.py` now contains compatibility aliases only. New commands belong in `commands/`; reusable logic does not.

## Dependency direction

```text
manage.py -> commands -> services -> external APIs / Supabase
                       -> repositories
dashboard ------------^ 
tests ----------------^ 
```

This direction keeps Gmail, Jev, and database behavior testable without coupling it to a particular command name or browser screen.
