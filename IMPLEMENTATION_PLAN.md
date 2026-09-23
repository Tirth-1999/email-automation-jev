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

| Phase | Deliverable | Status | Commands |
| --- | --- | --- | --- |
| 0 | Architecture and implementation plan | Complete; maintained here | `npm ci`<br>`npm run check` |
| 1 | Gmail ingestion and Supabase persistence | Working with paginated full-mailbox ingestion | Apply `001_email_ingestion.sql`<br>`npm run gmail:auth`<br>`npm run ingest`<br>`npm run ingest:full`<br>`npm run ingest:resume`<br>`npm run inspect` |
| 2 | Human labeling and evaluation set | Complete for the first 200 emails | `npm run sample:emails` once<br>`npm run dashboard`<br>Use **Add emails** for later samples |
| 3 | Jev classifier and benchmark | Complete for category ground truth; other judgments remain unscored | `npm run jev:prepare`<br>`npm run jev:evaluate`<br>`npm run jev:evaluate:all` |
| 4 | Dashboard shell and UI migration | Complete | `npm run dashboard`<br>Optional: `LABELING_UI_PORT=4174 npm run dashboard` |
| 5 | Durable run, result, and human-label storage | Complete; simplified to five tables and one read view | Apply migrations `002` through `005` in order<br>`npm run phase5:bootstrap` |
| 6 | Classification worker and Command Center | Complete; the UI orchestrates incremental Gmail sync → unclassified Jev run → publication to Email Board, Applications, and Analytics | `npm run dashboard`<br>Open **Command Center** and run the three numbered steps<br>CLI fallback: `npm run classify -- --scope unclassified --limit 25 --concurrency 3 --batch-size 10` |
| 7 | Full-dataset validation and production classification | Complete; the full mailbox has 6,602 classified emails, including a successful 6,152-email production run after controlled validation | `npm run dashboard`, then use **Command Center** for incremental production runs<br>Use **Jev Lab → Performance** only for disposable timing experiments |
| 8 | Human corrections and LLM reply drafts | Complete; GPT-4o Mini drafting is limited to Reply Needed emails | `npm run dashboard`<br>Open **Application Board → Emails**, select an email, correct its category or generate a draft<br>Configure `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-4o-mini`, and optional `REPLY_WRITING_PROFILE` |
| 9 | Email decisions and analytics | Complete; Kanban lanes, category/action filtering, live mailbox aggregates, confidence, benchmark quality, and durable-run performance | `npm run dashboard`<br>Open **Application Board → Emails** or **Analytics**<br>Click an Analytics category/action bar to inspect its source emails |
| 10 | Application grouping, lifecycle, and application board | Complete for the classified corpus; deterministic identity rules plus confidence-gated Jev relationship checks handle reused Gmail threads, with automatic materialization, explainable ghosting, manual review, application Kanban, and Sankey | Apply `006_application_lifecycle.sql` once<br>Normally publish from **Command Center**; recovery: `npm run applications:group`<br>Open **Application Board → Applications** or **Analytics** |
| 11 | Scheduling, observability, and draft assistance | Complete; hourly incremental orchestration, atomic lease, structured body-free logs, health probe, optional failure webhook, and reviewed drafts | Apply `007_operations_automation.sql` once<br>Test: `npm run automate:once`<br>Continuous runner: `npm run scheduler`<br>Probe: `GET /api/operations/health` |
| 12 | AI data assistant / RAG | Later roadmap | Not available yet |

Run all commands from the repository root. Keep secrets in `.env`, use `.env.example` as the checklist, and never commit `.env`, `.gmail-token.json`, or `data/labeling/generated/`. `npm run check` is the final validation command after every implemented phase.

## Architecture decisions

- Supabase Postgres is the system of record. Pinecone is not needed for ingestion or classification.
- Gmail message ID is the external deduplication key; an internal UUID remains the database primary key.
- Gmail thread IDs are retained but are not assumed to equal job applications.
- Gmail, Supabase service, TypeSafe, and future OpenAI credentials remain server-side.
- Jev outputs are immutable, versioned observations. A later run creates a new result instead of overwriting an old one.
- Human-confirmed labels are ground truth. Jev and LLM output never becomes ground truth automatically.
- Ghosting is derived only from an established multi-message conversation that ends with an unanswered outgoing email; cold outreach and application confirmations do not age into Ghosted.
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

The unified dashboard uses four top-level product areas:

1. **Command Center** — configure, start, resume, and monitor sync or classification runs.
2. **Application Board** — switch between **Emails** for message-level decisions and **Applications** for grouped job lifecycles.
3. **Jev Lab** — one model-development workspace with **Label Set**, **Quality**, and **Performance** modes. Label Set maintains human ground truth; Quality compares Jev with those labels; Performance measures live latency and throughput without saving experimental decisions as production results.
4. **Analytics** — inspect category, action, confidence, accuracy, and processing trends.

Command Center owns production operations. Jev Lab owns model development and testing. Other tabs consume durable results and never hide long-running work inside a browser request. The planned AI Assistant remains in the roadmap but is intentionally absent from navigation until it is functional.

## Target project layout

The current working UI will be migrated without a rewrite:

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
  server/
    index.ts
    routes/
    workers/
      classify-emails.ts
lib/                             # shared Gmail, Jev, database, and domain logic
scripts/                         # thin CLI entry points using shared logic
supabase/migrations/
```

The dashboard now serves the migrated labeling and evaluation workflows inside Jev Lab. The superseded `labeling-ui` path was retired after parity verification.

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
- Preserve the labeling and evaluation behavior, shared email reader, and bottom review progress controls.
- Consolidate Label Set, Quality, and Performance under Jev Lab while keeping production operations and result views distinct.
- Split shared components only after parity is verified.

### Acceptance criteria

- [x] Jev Lab → Label Set behaves exactly as the original Review Emails workflow.
- [x] Jev Lab → Quality displays the same metrics and expandable evidence.
- [x] Hash-addressable navigation and refresh work for every implemented tab.
- [x] Legacy UI removed after visual, API, type, and test parity passed.

---

## Phase 5 — Durable classification and correction schema

Status: complete — migrations are live in Supabase, all 200 existing human labels are preserved, and 2,455 existing Jev results survived the schema simplification.

The MVP intentionally uses five tables rather than separate registry, label-event, and review-case tables:

| Object | Purpose |
| --- | --- |
| `gmail_accounts` | Connected Gmail identities and synchronization cursor |
| `emails` | Normalized email content, current human correction, and current reviewed reply draft |
| `sync_runs` | Gmail ingestion history and counters |
| `classification_runs` | Frozen Jev configuration, selection, progress, and terminal run state |
| `email_classifications` | Per-email queue state and immutable Jev output for each run |
| `email_board` view | Latest production Jev result plus the current human override |

### `classification_runs`

One row per benchmark, diagnostic, production, or reprocessing batch. It stores mailbox, status, classifier/model version, the frozen classifier configuration, selection rules, frozen total count, progress counters, confidence threshold, concurrency, batch size, timestamps, and sanitized run errors.

Statuses: `queued`, `running`, `succeeded`, `partial`, `failed`, or `cancelled`.

### `email_classifications`

One immutable row per email per run. It stores source IDs, processing status, category and full probability distribution, next action and distribution, urgency, draft probability and policy decision, returned model, token usage, timestamps, and sanitized errors.

Required constraint: `unique (run_id, email_id)`.

### Human corrections and drafts

The `emails` table holds the current human-confirmed category, optional action/urgency/draft judgments, label source, notes, and timestamp. It also holds the latest generated reply draft and the model/instructions that produced it. The original Jev observation remains untouched in `email_classifications`.

This is an intentional MVP tradeoff: it keeps the database understandable. If multi-user audit history becomes a real requirement, append-only correction and draft-history tables can be added later without changing the current API.

### Safety and access

- Browser clients receive only scoped data through the server API.
- Service-role and provider API keys are never sent to browser code.
- Row-level security is enabled before remote multi-user access.
- Email bodies are not written into logs or generic error fields.

### Acceptance criteria

- [x] Classification runs and per-email results have durable, constrained schemas.
- [x] Completed classification results cannot be edited in place.
- [x] Current human corrections are idempotently importable and cannot overwrite Jev results.
- [x] The Email Board combines the latest production result with the current human correction.
- [x] RLS blocks browser roles; the server service role has the required access.
- [x] The 200-label bootstrap is repeatable and creates no duplicates.
- [x] Every run freezes the Jev version and classifier configuration used for its results.

---

## Phase 6 — Classification worker and Command Center

Status: complete. The TypeScript CLI and dashboard use the same durable worker. No new mailbox-wide run was started as part of implementation.

### Batch-processing contract

1. Create a classification run.
2. Resolve email IDs once and freeze them as queued result rows.
3. Read queued work in bounded batches.
4. Process through a concurrency-limited worker pool.
5. Send the four Jev questions together for each email.
6. Keep the active batch in memory and persist all of its successes and failures with one bulk upsert after the batch finishes.
7. Retry transient rate-limit and server errors with exponential backoff and jitter.
8. Isolate permanent per-email failures without discarding completed work.
9. Update aggregate counters continuously.
10. Finish as `succeeded`, `partial`, `failed`, or `cancelled`.

The CLI and dashboard call the same worker. A browser connection never owns the job. Command Center also calls the same incremental Gmail ingestion service as the CLI, reports newly inserted and updated emails, and prevents Gmail ingestion and production classification from overlapping.

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

### Implemented

- Email IDs are selected once and inserted as queued result rows before inference starts.
- Each worker batch bulk-loads email state from Supabase before Jev fan-out instead of issuing one competing read per email.
- Scope supports all, unclassified, uncertain, failed, date-bounded, maximum-count, and explicit email selections.
- Concurrency is limited to 1–10, batch size to 1–250, and SDK retries to 0–6.
- TypeSafe handles retryable connection, timeout, rate-limit, and server responses with exponential backoff, jitter, and `Retry-After` support.
- Each completed batch is persisted with one bulk upsert; aggregate counters refresh after that batch commit.
- Cancellation is durable and checked before scheduling the next batch.
- Cancelled, partial, failed-with-queued-work, and interrupted running batches can resume without selecting new email IDs.
- The CLI supports new and resumed runs through `npm run classify`.
- Command Center presents one ordered operational pipeline: incremental Gmail sync, Jev classification of the resulting unclassified pool, and publication of the same durable result set to Email Board, Applications, and Analytics.
- Successful and partially successful production runs automatically rebuild the application model. **Publish latest results** provides an idempotent manual recovery path.
- Email Board and Applications paginate through the complete result set instead of truncating at the first 500 or 1,000 records; Analytics reads the same complete corpus.
- The normal Sync Gmail action resumes from `gmail_accounts.latest_history_id`; only a missing or expired Gmail history cursor triggers a full/recovery scan.
- Gmail and Jev jobs are single-flight operations and cannot overlap; the UI polls their state every two seconds.
- Gmail progress exposes discovery, pending, inserted, updated, skipped, and deleted counts while durable `sync_runs` remain the source of historical truth.
- Advanced classification settings retain count-only preview, scope configuration, cancellation, and resume.

### Controlled first run

```bash
npm run classify -- --scope unclassified --limit 25 --concurrency 3 --batch-size 10
```

Inspect the durable result set in Command Center before increasing the limit. Resume an interrupted run with:

```bash
npm run classify -- --run-id RUN_UUID
```

### Acceptance criteria

- [x] A run freezes selected email IDs before classification starts.
- [x] Four Jev judgments are sent together for each email.
- [x] Concurrency, batching, retries, partial failure, and cancellation are bounded and persisted.
- [x] Completed batches are written atomically at the batch boundary and terminal results remain immutable.
- [x] Run counters and progress are visible through the Command Center.
- [x] Queued work can resume without re-enqueuing completed results.
- [x] New Gmail messages can be incrementally ingested from Command Center before classification.
- [x] The pipeline shows how many emails are stored, Jev-classified, waiting, and human-corrected.
- [x] Ingestion and classification are mutually exclusive, preventing a changing classification scope during sync.
- [x] A completed production run automatically feeds Email Board, Applications, and the application-level Sankey from one durable result set.
- [x] CLI, server, worker, browser JavaScript, type checks, and automated tests pass.

---

## Phase 7 — Full-dataset validation and production classification

The mailbox-wide run deliberately follows durable storage and resumability.

1. Freeze and version the complete human dataset.
2. Verify the deterministic development and held-out split.
3. Regenerate the development-derived, versioned criteria/reference configuration without including held-out emails.
4. Run the held-out benchmark and inspect disagreements in **Jev Lab → Quality**.
5. Approve or reject the classifier version using documented thresholds.
6. Smoke-test a durable production run on 25 emails.
7. Run 200 emails and verify persistence, retry, resume, and usage reporting.
8. Run the full active mailbox with no artificial item limit.
9. Reconcile selected, succeeded, failed, and skipped counts.
10. Publish the approved run to the default Email Board view.

Supabase persistence is part of the run itself, not a risky one-time upload after all calls finish.

### Jev Lab performance finding

The initial 500-at-once test completed 500/500 Jev calls with no rate limits, but 500 individual Supabase reads created about 3,962 ms of average application overhead. After replacing that N+1 pattern with chunked bulk loading, a later 500-email validation completed 500/500 in 3.94 seconds with no rate limits. Its classification wave took 1.10 seconds, successful throughput reached 456.6 emails/second, and average application overhead fell to 1 ms.

The 6,000-email stress test at concurrency 500 established the service boundary rather than a production setting. It finished all attempts in 19.63 seconds: 1,321 succeeded and 4,679 received HTTP 429, for 121.9 successful emails/second. Selection took 2.40 seconds, bulk loading took 6.39 seconds, and the classification stage took 10.84 seconds. Successful Jev calls averaged 714 ms, with p50 353 ms and p95 2,467 ms. The next performance gate is to test lower concurrency choices and identify the highest setting with no rate-limit failures.

The durable worker uses the same bulk-read shape. It accumulates each bounded batch in memory and persists that completed batch with one Supabase upsert, retaining batch-level resumability without issuing one database write per email.

---

## Phase 8 — Corrections and contextual reply drafts

Status: complete. The Email Board exposes both the Jev decision and the effective human-confirmed category, and can generate a structured draft with GPT-4o Mini through a server-side OpenAI Responses API call.

### Manual correction flow

When a user changes a tile or benchmark decision:

1. keep the original Jev result unchanged;
2. show the email, Jev decision, confidence, next action, and current human decision together;
3. require an explicit category and Save action;
4. store the current correction, notes, source, and timestamp on the email;
5. add or update the same email in the private Jev Lab Label Set and canonical labeled JSON;
6. refresh the board from the `email_board` view;
7. include confirmed corrections in the next dataset version according to split policy.

This closes the learning loop without pretending that Jev learns online from one edit.

### Contextual reply-draft flow

A user may send a selected **Reply Needed** email, Jev category/action, human correction notes, and editable personal writing instructions to GPT-4o Mini through the server. The model returns a structured subject and body for review.

- It is called only after the user clicks **Generate draft**.
- It never sends an email or opens a Gmail compose action.
- It never overwrites Jev history or writes a human label.
- The prompt forbids invented qualifications, dates, availability, authorization, compensation, attachments, or commitments.
- Missing facts must be represented as `[confirm ...]` placeholders.
- The latest reviewed draft, provider, model, personal instructions, and generation time are stored on the email.
- OpenAI response storage is disabled with `store: false`.

`OPENAI_API_KEY` and `OPENAI_MODEL` are server-only. `REPLY_WRITING_PROFILE` supplies the default personal style and factual boundaries. The browser receives only whether the provider is ready.

### Acceptance criteria

- [x] A correction updates the effective category without mutating the Jev result.
- [x] A correction becomes a visible Jev Lab Label Set example and canonical human label.
- [x] Full email context and correction notes are available beside the decision.
- [x] Reply generation uses structured output and saves a reviewable subject/body.
- [x] Draft generation is impossible without explicit user action and provider configuration.
- [x] Reply controls are absent for other categories and the API independently enforces the same rule.
- [x] Nothing in this phase can send an email.

### Dataset improvement rule

Confirmed corrections enter the next dataset version. Every changed criterion/example set, question, threshold, or composition policy creates a new classifier version and must pass the untouched held-out release gate. Benchmark errors must not leak silently into that gate; held-out refreshes require an explicit dataset-version migration.

---

## Phase 9 — Email Board and analytics

### Email Board

Kanban lanes: Applied, Outreach, Reply Needed, Interview / Assessment, Offer, Rejected, Other, and Uncertain.

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

Grouping uses a cascade rather than equating Gmail threads with applications: explicit requisition conflicts split immediately; matching requisitions or company/role evidence join deterministically; outgoing replies stay connected when no conflict exists; and unresolved same-thread pairs are sent to a batched Jev Noul asking whether they represent the same specific opportunity. The application only joins high-probability matches and conservatively separates API failures or uncertain answers.

Only then add one card per application, deterministic lifecycle precedence, explainable conversation-based ghosting, company funnels, conversion/time-to-response analytics, and Sankey paths such as `Applied → Reply Needed → Interview / Assessment → Offer / Rejected / Ghosted`. Separate cold-outreach threads remain independent and retain Outreach unless later inbound evidence establishes a conversation. Building those metrics directly from email counts would double-count applications.

---

## Phase 11 — Scheduling, observability, and draft assistance

Status: complete. Migration 007 adds an expiring, account-scoped pipeline lease and the latest automation health snapshot to `gmail_accounts`; it does not add another table. Detailed history remains in the existing `sync_runs` and `classification_runs` tables.

- `npm run automate:once` performs incremental Gmail sync → unclassified Jev classification → application/analytics publication.
- `npm run scheduler` runs immediately and then hourly on wall-clock boundaries by default.
- Supabase RPC acquisition prevents scheduled work from overlapping sync or classification work across processes; the existing Command Center also respects the lease.
- Structured JSON logs and `/api/operations/health` expose stages, counts, durations, freshness, and sanitized errors without email content.
- An optional HTTPS failure webhook carries only body-free operational metadata.
- Gmail and TypeSafe retry behavior remains bounded by the existing controllers and SDK configuration.
- Reply generation is restricted to effective `reply_needed` emails. Users can edit and explicitly save a reviewed version; the application has no send endpoint.
- Browser roles remain blocked by RLS, API credentials remain server-side, and no message content enters operational logs or alerts.

Gmail push notifications remain a later optimization. Hourly incremental history sync is the simpler reliable production default for the current mailbox volume.

---

## Phase 12 — AI Assistant / RAG roadmap

This is intentionally deferred until classification and application grouping are reliable. A future **AI Assistant** will support questions such as “How many applications did I complete this month?” and “Show interviews needing action.” Its first version is read-only and will enter navigation only when functional.

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

The repository was audited at this planning point. Gmail auth/ingestion, inspection, sampling, labeling server, Jev preparation, and Jev evaluation scripts are all still reachable from active package commands or current UI workflows. They are not dead code yet.

### Keep for now

- Gmail authentication and ingestion scripts.
- Email inspection and sampling scripts.
- The current labeling UI and its server.
- Jev dataset preparation and evaluation scripts.
- Private generated datasets and benchmark artifacts needed for reproducibility.

### Retire later

- The legacy `labeling-ui` and `scripts/serve-labeling-ui.ts` were removed after dashboard parity checks passed.
- Convert CLI scripts into thin wrappers over shared library/worker functions; remove duplicated internals after tests pass.
- Archive or prune generated artifacts only after a versioned manifest proves they are reproducible and no active run references them.
- Never rewrite database migration history already applied remotely.

### Deletion gate

Before deleting a file: prove it has no command/import/documentation/test/migration/runtime dependency; verify replacement parity; run type checks and tests; preserve required data/history; and record the deletion in its replacement phase.

The duplicate dashboard plan and superseded labeling UI/server were removed after their replacements passed the deletion gate. The remaining operational scripts are still active.

## Delivery order from here

1. Finish Phase 7 by identifying a sustainable Jev concurrency and classifying the remaining mailbox.
2. Validate Phase 10 grouping quality on the fully classified mailbox and correct ambiguous applications in the Applications workspace.
3. Deploy Phase 11 with `npm run automate:once` hourly, or keep `npm run scheduler` alive under a process manager.

For every phase: confirm scope, implement, run automated checks, verify acceptance criteria together, update this plan, and only then begin the next phase.
