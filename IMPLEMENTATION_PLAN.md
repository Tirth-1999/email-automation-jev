# Email Automation Jev — Implementation Plan

This is the single delivery contract and architecture plan for the project. It is updated when decisions change, and a phase is complete only after its acceptance checks pass.

## Product outcome

Build a dependable job-email workspace that:

1. reads all relevant received and sent Gmail messages, excluding drafts, spam, and trash;
2. stores normalized email data in Supabase without duplicates;
3. classifies emails with a versioned Jev pipeline;
4. measures Jev against human-reviewed examples before production use;
5. lets a human correct decisions and grow a trustworthy labeled dataset;
6. optionally asks an LLM for a second opinion on difficult cases without treating that opinion as truth;
7. presents operations, review, evaluation, classified emails, and analytics in one dashboard;
8. later groups emails into job applications and adds a read-only AI assistant over the resulting data.

## Current status

| Phase | Deliverable | Status |
| --- | --- | --- |
| 0 | Architecture and implementation plan | Complete; maintained here |
| 1 | Gmail ingestion and Supabase persistence | Working with paginated full-mailbox ingestion |
| 2 | Human labeling and evaluation set | Complete for the first 200 emails |
| 3 | Jev classifier and benchmark | Working; durable production runs remain |
| 4 | Dashboard shell and UI migration | Complete |
| 5 | Durable run, result, review, and label storage | Complete |
| 5.5 | Python migration and TypeScript retirement | Complete |
| 6 | Classification worker and Command Center | Complete; ready for a controlled production run |
| 7 | Full-dataset validation and production classification | Not started |
| 8 | Correction and optional LLM-review workflow | Not started |
| 9 | Email Board and analytics | Not started |
| 10 | Application grouping, lifecycle, and application board | Not started |
| 11 | Scheduling, observability, and draft assistance | Not started |
| 12 | AI data assistant / RAG | Later roadmap |

## Architecture decisions

- Supabase Postgres is the system of record. Pinecone is not needed for ingestion or classification.
- Gmail message ID is the external deduplication key; an internal UUID remains the database primary key.
- Gmail thread IDs are retained but are not assumed to equal job applications.
- Gmail, Supabase service, TypeSafe, and future OpenAI credentials remain server-side.
- Jev outputs are immutable, versioned observations. A later run creates a new result instead of overwriting an old one.
- Human-confirmed labels are ground truth. Jev and LLM suggestions never become ground truth automatically.
- Ghosting is derived from application activity and elapsed time, not classified from one email.
- The first operational board is an **Email Board**. An **Application Board** follows only after reliable grouping.
- The dashboard may remain framework-free until component complexity justifies a frontend framework.

## Product language

- **Email category:** `applied`, `outreach`, `reply_needed`, `interview_assessment`, `offer`, `rejected`, or `other`.
- **Next action:** what the user should do, such as write a reply, open a link, fill a form, schedule, or complete an assessment.
- **Urgency:** how quickly the next action should be handled.
- **Draft needed:** whether a written email response should be prepared.
- **Classification run:** one frozen, versioned batch processed with one exact Jev configuration.
- **Result set:** all results belonging to one classification run.
- **Human label:** a decision explicitly confirmed by a person.
- **LLM review:** an advisory second opinion that must be confirmed or rejected by a person.
- **Classifier version:** the exact Jev questions, criteria, model selection, composition policy, and reference-example version used by a run.

## Dashboard navigation

The unified dashboard will grow to these tabs:

1. **Command Center** — configure, start, resume, and monitor sync or classification runs.
2. **Review Emails** — create and maintain human labels.
3. **Evaluate Jev** — compare a selected result set with human ground truth.
4. **Email Board** — inspect classified email cards and make audited corrections.
5. **Analytics** — inspect category, action, confidence, accuracy, and processing trends.
6. **AI Assistant** — later, a read-only conversational interface over application data and email evidence.

Command Center owns operations. Other tabs consume durable results and never hide long-running work inside a browser request.

## Target project layout

The dashboard remains framework-free, while all server-side and command-line code is Python:

```text
apps/
  dashboard/
    index.html
    src/
      app.js
      api.js
      styles.css
      views/
        command-center.js
        review-emails.js
        evaluate-jev.js
        email-board.js
        analytics.js
        ai-assistant.js          # later phase
      components/
        app-shell.js
        email-reader.js
        run-progress.js
        result-card.js
src/email_automation_jev/
  dashboard.py                   # local dashboard API and static-file server
  cli.py                         # thin command entry points
  ingestion.py                   # Gmail synchronization workflow
  jev_classifier.py              # shared production/evaluation classifier
  repository.py                  # Supabase persistence
tests/                           # pytest behavior tests
supabase/migrations/
```

The dashboard now serves the migrated Review Emails and Evaluate Jev workflows. The superseded `labeling-ui` path was retired after parity verification.

---

## Phase 1 — Gmail ingestion and Supabase persistence

### Goal

Import received and sent Gmail messages reliably. Repeated synchronization must not create duplicates or lose position.

### Implemented direction

- Gmail read-only OAuth.
- Paginated discovery with no artificial 5,000-message ceiling.
- Received and sent messages included; drafts, spam, and trash excluded.
- Controlled concurrency, quota-aware retries, and exponential backoff.
- Normalized headers, body text/HTML, labels, timestamps, and attachment metadata.
- Upsert by `(gmail_account_id, gmail_message_id)`.
- Synchronization statistics and durable run information.

### Core tables

- `gmail_accounts`: account identity, Gmail address, history cursor, last sync, and health.
- `emails`: immutable Gmail identity plus normalized headers, bodies, labels, direction, and metadata.
- `sync_runs`: sync type, timestamps, discovered/inserted/updated/skipped counts, status, and sanitized errors.

### Remaining acceptance checks

- [ ] Rerunning a full sync creates zero duplicates.
- [ ] Incremental sync captures new received and sent messages.
- [ ] Expired Gmail history falls back safely to a full reconciliation.
- [ ] Counts and sampled message bodies match Gmail.
- [ ] Failed runs remain visible and retryable.

---

## Phase 2 — Human labels and evaluation set

Status: the initial set contains 200 unique reviewed emails with a deterministic 160-development / 39-held-out / 1-manual-review split.

### Rules

- Categories are `applied`, `outreach`, `reply_needed`, `interview_assessment`, `offer`, `rejected`, and `other`.
- Sampling is duplicate-free and may be repeated to improve category coverage.
- Important rare senders or outcomes, such as the known ATC offer, may be deliberately oversampled.
- Ambiguous items may remain in manual review instead of receiving false certainty.
- Held-out examples are never used in Jev reference examples, prompt development, or threshold selection.

### Dataset lifecycle

```text
Human review or confirmed correction
        ↓
Versioned human-label history
        ↓
Deterministic development / held-out split
        ↓
Curated, versioned criteria and reference examples derived from development data only
        ↓
Held-out benchmark
        ↓
Approve a classifier version for production
```

The growing “parent document” is a versioned classifier configuration derived from development-set errors—not an unbounded dump of labeled email bodies sent with every API call. Curated examples may be added to structured criteria when measurement shows they help. Any configuration change creates a new classifier version and must pass the held-out benchmark again.

---

## Phase 3 — Jev classifier and benchmark

Status: a versioned multi-judgment classifier and API-backed evaluation UI are working.

### One request per email

The current classifier asks four independent questions over the same normalized email state:

- category with **Choice**;
- next action with **Choice**;
- urgency with **Score**;
- whether a written draft is needed with **Noul**.

Application policy may set `should_draft` only when the category is `reply_needed` and the Noul probability passes the configured threshold.

### Current benchmark baseline

- Held-out set: 39 emails, classifier v4.
- Raw category accuracy: 87.2%.
- Automatic coverage: 97.4%.
- Accuracy among automatically accepted results: 86.8%.
- All-label diagnostic: 199 emails, 89.4% raw accuracy and 90.1% automatic accuracy at 96.5% coverage.

The all-label run is diagnostic because it includes development examples. Only the held-out run is an unbiased release gate.

### Remaining acceptance checks

- [x] Held-out accuracy, coverage, and per-item disagreements are visible.
- [x] Full subject, sender/header, body, and Gmail link are available during evaluation.
- [x] Category is scored only where a human category label exists.
- [ ] Next action, urgency, and draft-needed receive human ground truth before their quality is claimed.
- [ ] Production runs are persisted and resumable.

---

## Phase 4 — Dashboard shell and UI migration

### Scope

- Move the current UI to `apps/dashboard` without changing its working behavior.
- Preserve the Review Emails / Evaluate Jev pill navigation, shared email reader, and bottom review progress controls.
- Add empty but clearly labeled Command Center, Email Board, Analytics, and future AI Assistant routes.
- Split shared components only after parity is verified.

### Acceptance criteria

- [x] Review Emails behaves exactly as before migration.
- [x] Evaluate Jev displays the same metrics and expandable evidence.
- [x] Hash-addressable navigation and refresh work for every implemented tab.
- [x] Legacy UI removed after visual, API, type, and test parity passed.

---

## Phase 5 — Durable classification, label, and review schema

Status: complete — migrations are live in Supabase, all 200 existing human labels are imported, and Jev v4 is registered as an approved classifier version.

### `classification_runs`

One row per benchmark, diagnostic, production, or reprocessing batch. It stores mailbox, status, classifier/model version, selection rules, frozen total count, progress counters, confidence threshold, concurrency, batch size, timestamps, and sanitized run errors.

Statuses: `queued`, `running`, `succeeded`, `partial`, `failed`, or `cancelled`.

### `email_classification_results`

One immutable row per email per run. It stores source IDs, processing status, category and full probability distribution, next action and distribution, urgency, draft probability and policy decision, returned model, token usage, timestamps, and sanitized errors.

Required constraint: `unique (run_id, email_id)`.

### `email_human_label_events`

Append-only human decisions with email ID; category and later action/urgency/draft labels; source (`review_ui`, `board_override`, or `llm_review_confirmation`); reviewer; notes; timestamp; and superseded event reference. A view exposes the latest confirmed label while history remains auditable.

### `classification_review_cases`

Tracks email/result IDs; reason (`low_confidence`, `human_disagreement`, `manual_override`, or `processing_issue`); status; immutable Jev snapshot; optional LLM provider/model/suggestion/usage/error; final human decision; notes; reviewer; and timestamps.

### `classifier_versions`

Records exact question configuration, composition policy, source dataset/reference version, release status, and benchmark summary. A production run points to one approved version.

### Views

- `latest_email_classifications`
- `latest_email_human_labels`
- `classification_run_summary`
- `email_board_items`

### Safety and access

- Browser clients receive only scoped data through the server API.
- Service-role and provider API keys are never sent to browser code.
- Row-level security is enabled before remote multi-user access.
- Email bodies are not written into logs or generic error fields.

### Acceptance criteria

- [x] Classification runs and per-email results have durable, constrained schemas.
- [x] Completed classification results cannot be edited in place.
- [x] Human-label corrections are append-only and idempotently importable.
- [x] Review cases can preserve Jev and future LLM evidence separately.
- [x] Latest-classification, latest-human-label, run-summary, and email-board views exist.
- [x] RLS blocks browser roles; the server service role has the required access.
- [x] The 200-label bootstrap is repeatable and creates no duplicates.
- [x] The approved Jev v4 record stores benchmark summary and dataset version.

---

## Phase 5.5 — Python migration

Status: complete. All Gmail, Supabase, Jev, sampling, evaluation, dashboard-server, and CLI logic uses Python 3.11+ with a conventional `src/` package. `uv.lock` freezes dependencies, Ruff checks formatting and common defects, and pytest verifies the core behavior. Existing SQL migrations and private data formats are unchanged, so the migration does not require re-ingestion, re-labeling, or a database migration.

The browser dashboard intentionally remains plain JavaScript because browsers execute JavaScript directly. It contains presentation and interaction code only; the system logic the user needs to understand and explain is Python.

### Acceptance criteria

- [x] Every former TypeScript server/CLI capability has a Python entry point.
- [x] Gmail pagination, incremental history, retry, parsing, and sampling behavior is covered by Python tests.
- [x] Jev uses the official Python SDK with the same four judgments and classifier version.
- [x] Existing Supabase tables, JSON datasets, and dashboard API paths remain compatible.
- [x] TypeScript sources, Node manifests, and Node dependencies are retired after parity checks.

---

## Phase 6 — Classification worker and Command Center

Status: complete for implementation. The worker and dashboard are ready for a controlled run; no production Jev batch was started automatically.

### Implemented

- `classification_worker.py` creates bounded, durable production runs and freezes the selected email IDs as queued result rows.
- Worker batches use configurable concurrency (`1–10`) and batch size (`1–250`), persist each result immediately, refresh counters after each batch, and preserve failures without losing successful work.
- Jev provider rate-limit, timeout, and server failures use bounded exponential retry. Permanent email failures become `failed` result rows with sanitized error text.
- Cancellation is persisted on `classification_runs.cancellation_requested_at`; the worker stops scheduling new batches and leaves completed work intact.
- `./email classify` supports `all`, `unclassified`, `uncertain`, and `failed` scopes, limits, concurrency, batch size, thresholds, and `--run-id` resume.
- The Command Center now has preview, start, recent-run progress, five-second polling, and cancellation controls through `/api/command/preview`, `/api/command/runs`, `/api/command/status`, and `/api/command/cancel`.

### Controlled first run

Start with a small limit and verify the result set in the dashboard:

```bash
./email classify --scope unclassified --limit 25 --concurrency 3 --batch-size 10
```

Then increase the limit after checking the run counters and Jev usage:

```bash
./email classify --scope unclassified --limit 200
```

The same operation can be launched from **Command Center**. The dashboard request returns after queuing; the Python worker continues in the background and the durable run remains the source of truth.

### Acceptance criteria

- [x] A run freezes selected email IDs before classification starts.
- [x] Four Jev judgments are sent together for each email.
- [x] Concurrency, batching, retries, partial failure, and cancellation are bounded and persisted.
- [x] Completed results are written immediately and remain immutable.
- [x] Run counters and progress are visible through the Command Center.
- [x] A run can be resumed with `--run-id` without re-enqueuing completed results.
- [x] Local worker/configuration tests and dashboard JavaScript checks pass.

### Batch-processing contract

1. Create a classification run.
2. Resolve email IDs once and freeze them as queued result rows.
3. Read queued work in bounded batches.
4. Process through a concurrency-limited worker pool.
5. Send the four Jev questions together for each email.
6. Persist each result immediately.
7. Retry transient rate-limit and server errors with exponential backoff and jitter.
8. Isolate permanent per-email failures without discarding completed work.
9. Update aggregate counters continuously.
10. Finish as `succeeded`, `partial`, `failed`, or `cancelled`.

The CLI and dashboard call the same worker. A browser connection never owns the job.

Initial measured defaults: concurrency `5`, batch size `25`, maximum concurrency `10`, and at most `6` retry attempts.

### Command Center controls

- mailbox;
- all, unclassified, failed, uncertain, or custom scope;
- date range and optional maximum count;
- classifier version and model;
- confidence threshold;
- concurrency and batch size within server limits;
- skip existing results or deliberately reprocess.

A count-only preview shows selected, previously classified, to-process, and estimated batch counts. Live progress shows queued, processed, succeeded, failed, uncertain, elapsed time, throughput, approximate remaining time, classifier version, and latest sanitized error. Cancellation stops scheduling new batches and preserves completed results.

---

## Phase 7 — Full-dataset validation and production classification

The mailbox-wide run deliberately follows durable storage and resumability.

1. Freeze and version the complete human dataset.
2. Verify the deterministic development and held-out split.
3. Regenerate the development-derived, versioned criteria/reference configuration without including held-out emails.
4. Run the held-out benchmark and inspect disagreements in the UI.
5. Approve or reject the classifier version using documented thresholds.
6. Smoke-test a durable production run on 25 emails.
7. Run 200 emails and verify persistence, retry, resume, and usage reporting.
8. Run the full active mailbox with no artificial item limit.
9. Reconcile selected, succeeded, failed, and skipped counts.
10. Publish the approved run to the default Email Board view.

Supabase persistence is part of the run itself, not a risky one-time upload after all calls finish.

---

## Phase 8 — Corrections and optional LLM review

### Manual correction flow

When a user changes a tile or benchmark decision:

1. keep the original Jev result unchanged;
2. create or update a review case;
3. show Jev evidence and prior human-label history;
4. require explicit confirmation of corrected fields;
5. append a human-label event;
6. refresh the board from the latest confirmed label view;
7. include the confirmed example in the next dataset version according to split policy.

This closes the learning loop without pretending that Jev learns online from one edit.

### “Ask AI to review” flow

A disagreement or uncertain result may send the normalized email, label definitions, and Jev output to a configured OpenAI model through the server. The LLM returns a structured recommendation and concise evidence, displayed beside Jev.

- It never overwrites Jev history.
- It never writes a human label by itself.
- It never changes the classifier configuration automatically.
- A person must confirm, change, or dismiss it.
- Provider, model, prompt version, output, usage, and reviewer outcome are audited.

`OPENAI_API_KEY` is server-only. The first version is review-only and cannot send email.

### Dataset improvement rule

Confirmed corrections enter the next dataset version. Every changed criterion/example set, question, threshold, or composition policy creates a new classifier version and must pass the untouched held-out release gate. Benchmark errors must not leak silently into that gate; held-out refreshes require an explicit dataset-version migration.

---

## Phase 9 — Email Board and analytics

### Email Board

Columns: Applied, Outreach, Reply Needed, Interview / Assessment, Offer, Rejected, Other, and Uncertain.

Cards show subject, sender/company hint, date, next action, urgency, confidence, and direction. Opening a card shows full evidence and its Gmail link. Moving a card starts the manual correction flow; it does not mutate historical inference. Filters include result set, date, confidence, direction, category, and next action.

### Analytics

- email counts and trends by category;
- next-action and urgent-action backlog;
- confidence distribution and uncertain rate;
- failure, throughput, and token usage by run;
- benchmark accuracy, coverage, and confusion by classifier version;
- human disagreement and LLM-escalation resolution rates.

Every metric links to its result set or source emails.

---

## Phase 10 — Application grouping and lifecycle

Introduce `applications`, `application_messages`, and `application_status_events`. Extract or infer company, role, requisition ID, sender domain, and relevant dates; allow durable manual grouping overrides.

Only then add one card per application, deterministic lifecycle precedence, explainable ghosting, company funnels, conversion/time-to-response analytics, and Sankey paths such as `Applied → Reply Needed → Interview / Assessment → Offer / Rejected / Ghosted`. Building those metrics directly from email counts would double-count applications.

---

## Phase 11 — Scheduling, observability, and draft assistance

- Schedule incremental Gmail sync and classification hourly initially; later evaluate Gmail push notifications.
- Prevent overlapping work with account/run locks.
- Add structured logs, metrics, retries, and failure notification without logging email bodies.
- Apply retention and privacy controls.
- Generate suggested reply text or Gmail drafts only for eligible, human-visible items.
- Never send a message without explicit user confirmation.

---

## Phase 12 — AI Assistant / RAG roadmap

This is intentionally deferred until classification and application grouping are reliable. The **AI Assistant** tab will support questions such as “How many applications did I complete this month?” and “Show interviews needing action.” Its first version is read-only.

- Use safe SQL/query tools for structured counts, filters, and aggregations.
- Use retrieval over email/application text only for semantic evidence questions.
- Return citations that open the supporting email, application, or result set.
- Scope every query to the connected user/account.
- Do not expose arbitrary SQL, service credentials, or unrestricted database access to the model.
- Do not let the assistant send, delete, relabel, or modify email initially.
- Add vector storage only if measured semantic retrieval quality justifies it; Supabase `pgvector` is the first option before another datastore.

This feature remains roadmap/technical debt until its prerequisites are complete.

---

## Cleanup and retirement policy

The repository was audited after the Python migration. Gmail auth/ingestion, inspection, sampling, labeling server, Jev preparation, Jev evaluation, and Phase 6 worker commands are reachable through the Python package entry points.

### Keep for now

- Python Gmail authentication and ingestion commands.
- Python email inspection and sampling commands.
- The current browser labeling UI and Python dashboard server.
- Python Jev dataset preparation, evaluation, and classification commands.
- Private generated datasets and benchmark artifacts needed for reproducibility.

### Retire later

- TypeScript backend, CLI scripts, Node manifests, and TypeScript tests were removed after Python parity checks passed.
- Keep CLI commands thin wrappers over shared Python modules; remove duplicated internals after tests pass.
- Archive or prune generated artifacts only after a versioned manifest proves they are reproducible and no active run references them.
- Never rewrite database migration history already applied remotely.

### Deletion gate

Before deleting a file: prove it has no command/import/documentation/test/migration/runtime dependency; verify replacement parity; run type checks and tests; preserve required data/history; and record the deletion in its replacement phase.

The duplicate dashboard plan and superseded labeling UI/server were removed after their replacements passed the deletion gate. The remaining operational scripts are still active.

## Delivery order from here

1. **Next:** Phase 7, frozen dataset validation, benchmark approval, and staged mailbox run.
2. Phase 8, corrections and optional OpenAI review.
3. Phase 9, Email Board and analytics.
5. Later phases only after their prerequisites pass.

For every phase: confirm scope, implement, run automated checks, verify acceptance criteria together, update this plan, and only then begin the next phase.
