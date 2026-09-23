# Email Automation Jev

Email Automation Jev is a phased project for turning Gmail messages related to a job search into a reliable application tracker.

The application will ingest email through the Gmail API, store normalized messages in Supabase Postgres, classify job-related messages with TypeSafe's Jev model, group messages into job applications, and display those applications on a Kanban dashboard.

This repository is intentionally being built one phase at a time. The current source of truth is [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## Current status

**Gmail ingestion, the 200-email human dataset, Jev evaluation, resumable production classification, application grouping, Kanban boards, analytics, corrections, reviewed reply drafts, hourly automation, and operational health reporting are complete.**

- Why Supabase Postgres

Supabase Postgres is the system of record because the product has relational data:

- one account has many messages;
- messages belong to Gmail threads;
- several messages or threads may belong to one job application;
- classifications need confidence, probabilities, model versions, and corrections;
- an application has a status history.

Three thousand to five thousand emails is a small dataset for Postgres. Pinecone is not needed as the primary database. Vector search can be added later with `pgvector` if semantic search becomes valuable.

## Planned architecture

```text
Gmail API
   |
   | full sync, then incremental history sync
   v
Ingestion service
   |
   | normalize + idempotent upsert
   v
Supabase Postgres
   |
   | unclassified message batches
   v
TypeSafe Jev
   |
   | category + next action + urgency + draft-needed judgment
   v
Application grouping and lifecycle logic
   |
   v
Kanban dashboard -> Open original message in Gmail
```



## Intended categories

- `applied`
- `outreach`
- `reply_needed`
- `interview_assessment`
- `offer`
- `rejected`
- `ghosted`
- `other`

`ghosted` is different from the other categories. It is calculated only for an established conversation containing at least three messages across both directions when the latest message was sent by the job seeker and remains unanswered for the configured waiting period. Standalone applications and unanswered cold outreach remain `applied` and `outreach`.

`outreach` covers messages sent to recruiters, hiring managers, referrals, and other contacts to initiate or follow up on a job-search conversation.

## Jev evaluation preparation

The canonical private human-labeled dataset is `data/labeling/generated/labeled-emails.json`. Validate it and rebuild the deterministic development/holdout split with:

```bash
npm run jev:prepare
```

The versioned classifier sends four independent questions over the same email state in one TypeSafe request:

- a `Choice` for the seven email categories;
- a `Choice` for the concrete next action, including replying, opening a link, filling a form, scheduling, and completing an assessment;
- a `Score` for urgency;
- a `Noul` for whether a written email draft should be prepared.

`uncertain` is an application policy decision produced when the winning category probability is below `JEV_MIN_TOP_PROBABILITY`; it is not sent as a competing category. A draft is suggested only when the category decision is `reply_needed` and the Noul probability reaches `JEV_DRAFT_REPLY_THRESHOLD`.

After setting `TYPESAFE_API_KEY` in `.env`, run the 39-email held-out evaluation:

```bash
npm run jev:evaluate
```

For broader error analysis, run all 199 definitively labeled emails without replacing the held-out report:

```bash
npm run jev:evaluate:all
```

This larger result is diagnostic rather than a clean generalization estimate because it includes the 160 development examples. Those emails are used to improve and version the criteria; they are not dumped into each Jev request. The 39 held-out emails are never supplied as reference examples. The benchmark UI dataset selector keeps both reports available.

The evaluator imports the same classifier function and question configuration that production will call. It records the returned model version, full probability distributions, confidence, raw accuracy, automatic coverage, automatic-only accuracy, per-category results, and token usage. Run `npm run dashboard` and open **Jev Lab → Quality** to inspect the report. Saved results from an older classifier version are marked stale rather than mixed with the current benchmark.

The existing 200 human labels define email-category ground truth only. Therefore, the benchmark scores the category Choice and clearly displays next-action, urgency, and draft-needed outputs as unscored. Those fields need separate human labels before their accuracy can be claimed. The single offer example remains in development, so the first held-out report cannot measure offer accuracy.

## Durable classification data

The email/classification core deliberately contains only five tables: `gmail_accounts`, `emails`, `sync_runs`, `classification_runs`, and `email_classifications`. The `email_board` view combines each email with its latest completed production classification and current human correction. Phase 10 adds only the three relational tables required for application-level tracking: `applications`, `application_messages`, and `application_status_events`. Browser roles have no direct access; server code uses the Supabase service role.

Apply migrations `001` through `007` in filename order. Import or refresh the private labels with:

```bash
npm run phase5:bootstrap
```

The bootstrap is idempotent. It updates the current human-label columns on the matching email rows; Jev results remain immutable in `email_classifications`.

## Production classification

The Phase 6 worker freezes selected email IDs into a durable run before making Jev calls. It bulk-loads and processes bounded batches with concurrency limits, uses the TypeSafe SDK's retry and `Retry-After` behavior, saves each completed batch with one Supabase upsert, isolates per-email failures, and preserves unfinished batches for resume after cancellation or interruption.

Start with a controlled batch:

```bash
npm run classify -- --scope unclassified --limit 25 --concurrency 3 --batch-size 10
```

Resume an interrupted run without selecting new emails:

```bash
npm run classify -- --run-id RUN_UUID
```

Scopes are `unclassified`, `all`, `uncertain`, and `failed`. Optional `--after` and `--before` ISO timestamps restrict the selection window. Run `npm run dashboard`, open **Command Center**, and preview before starting. The UI polls durable progress, displays result counts and throughput, and supports cancellation and resume.

Closing the browser does not stop a run. If the Node server or CLI process stops, use `--run-id` or the Command Center resume action to continue its remaining queued rows.

### Run the mailbox from Command Center

Command Center is the normal operational entry point:

1. Click **Sync new emails**. The server continues from the saved Gmail history cursor, includes received and sent mail, includes Spam and Trash according to `.env`, excludes drafts, and reports new/updated counts. It performs a full scan only for the first sync or when Gmail reports that the saved history cursor has expired.
2. Click **Run Jev classification**. The displayed waiting count is frozen into a durable production run, classified in bounded batches, and persisted to Supabase.
3. Click **Publish latest results**. This verifies the classified-email corpus, rebuilds application groupings, and refreshes the Sankey. Successful Command Center classification runs perform this step automatically; the button is a safe manual refresh. Then open **Application Board → Emails** to inspect individual messages and save human corrections without modifying the original Jev observation.

Gmail ingestion and production classification cannot run at the same time. The dashboard may be closed after a job starts; Gmail history, `sync_runs`, classification runs, and completed Jev results remain durable in Supabase. The `email_board` view is the single classified-email source for Email Board, application materialization, and Analytics, so all three surfaces represent the same production result set.

## Correct a classification and draft a reply

Start the dashboard and open **Email Board**:

```bash
npm run dashboard
```

The board is arranged as horizontal Kanban lanes for Applied, Outreach, Reply Needed, Interview / Assessment, Offer, Rejected, Other, and Uncertain. Select a card to read its header and full body, compare the Jev result with the effective category, and save a manual correction with notes. Saving a correction never changes the historical Jev result; it also adds or updates that email in the private **Jev Lab → Label Set** pool and canonical labeled JSON for the next `jev:prepare` run.

Reply drafting is optional. Configure these server-only values in `.env`:

```env
OPENAI_API_KEY=replace_me
OPENAI_MODEL=gpt-4o-mini
REPLY_WRITING_PROFILE=Write as Tirth Shah in a concise, warm, professional tone. Never invent facts.
```

Restart the dashboard, select an email in the **Reply Needed** lane, adjust the personal instructions if needed, and click **Generate draft**. The app sends that email's context only at that moment, asks GPT-4o Mini for a structured subject/body, and saves the suggestion. Edit it and click **Save reviewed draft** to retain the human-approved version. Neither action sends email. Reply controls are not rendered for other categories, and the server rejects ineligible draft requests.

## Hourly automation and health

Apply `supabase/migrations/007_operations_automation.sql`, then configure the Phase 11 variables from `.env.example`. Run one complete incremental cycle manually before scheduling it:

```bash
npm run automate:once
```

That command acquires an atomic Supabase lease, incrementally syncs Gmail, classifies only newly unclassified emails, rebuilds Applications and Analytics, records body-free counts and durations, then releases the lease. A busy pipeline is skipped safely.

For a continuously running local or server process, set `AUTOMATION_ENABLED=true` and start:

```bash
npm run scheduler
```

The default interval is 60 minutes aligned to the next wall-clock boundary. For serverless or hosted cron, invoke `npm run automate:once` hourly instead of keeping the watcher alive. Configure `OPERATIONS_ALERT_WEBHOOK_URL` to receive sanitized failure payloads containing only the failed stage, error, counts, and durations—never email headers or bodies.

The Command Center health strip shows the latest scheduled cycle. A machine-readable probe is available at:

```text
GET /api/operations/health
```

It returns HTTP `503` for recorded pipeline failures, and otherwise reports healthy or degraded freshness. Existing RLS keeps browser roles away from email and operational state; all credentials remain server-side.

## Group applications and inspect lifecycle

Command Center now refreshes the application model automatically after a successful or partially successful production run. This CLI command remains available as a recovery or maintenance action:

```bash
npm run applications:group
```

Open **Application Board → Applications** for one card per grouped job opportunity. The grouping cascade uses requisition IDs and extracted company/role evidence first. Ambiguous messages inside the same Gmail thread are compared with a batched Jev yes/no relationship judgment. Manual company, role, requisition, and status edits are durable and append a manual lifecycle event.

Gmail conversation continuity is supporting evidence, not an application identity. Different requisitions never merge; shared job-board threads can split into multiple applications; outgoing replies remain attached when no employer or requisition conflict exists. Jev joins an ambiguous pair only at or above `JEV_APPLICATION_MATCH_THRESHOLD` (default `0.72`), and failures conservatively keep the pair separate. Existing manual assignments always take precedence over automatic regrouping.

Open **Analytics** for the application Sankey. It counts grouped applications rather than emails. `ghosted` is added only after an established three-or-more-message exchange has both incoming and outgoing participation, ends with an outgoing email, and receives no reply for `APPLICATION_GHOST_DAYS`. Cold outreach and application confirmations never age into Ghosted on time alone; the generated lifecycle event records the exact explanation.

## Message identity

The Gmail API's immutable message ID is the external identity used for deduplication. The database will use an internal UUID primary key plus this constraint:

```sql
unique (gmail_account_id, gmail_message_id)
```

This allows multiple Gmail accounts later while making every synchronization safe to rerun. `gmail_thread_id` is stored and indexed for conversation grouping. The RFC `Message-ID` header is retained as metadata but is not trusted as the database identity.

## Development principles

- Build and verify one phase before starting the next.
- Keep Gmail access read-only during the ingestion phases.
- Keep credentials server-side and out of Git.
- Preserve raw source identifiers and normalized fields.
- Make synchronization idempotent and observable.
- Save Jev's full probability distribution, not only its winning label.
- Route uncertain classifications to review instead of hiding uncertainty.
- Never let a model send an email automatically in the first version.



## Configuration

Local secrets belong in `.env` and must never be committed. Use `.env.example` as the current checklist of supported variables and placeholders.

The existing TypeSafe key should eventually use the SDK's expected variable name:

```env
TYPESAFE_API_KEY=replace_me
```

Do not paste real credentials into documentation, issues, or commits.

## Documentation

- [Implementation plan](./IMPLEMENTATION_PLAN.md)
- [Gmail synchronization guide](https://developers.google.com/workspace/gmail/api/guides/sync)
- [Gmail message resource](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages)
- [Supabase database guide](https://supabase.com/docs/guides/database/overview)
- [TypeSafe documentation](https://docs.typesafe.ai/llms.txt)
