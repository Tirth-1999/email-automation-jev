# Email Automation Jev

Email Automation Jev is a phased project for turning Gmail messages related to a job search into a reliable application tracker.

The application will ingest email through the Gmail API, store normalized messages in Supabase Postgres, classify job-related messages with TypeSafe's Jev model, group messages into job applications, and display those applications on a Kanban dashboard.

This repository is intentionally being built one phase at a time. The current source of truth is [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## Current status

**Gmail ingestion, the 200-email human dataset, Jev v4 evaluation, the dashboard shell, the durable Supabase classification schema, and the Python migration are complete. The resumable production worker and Command Center are next.**

## Python setup

The backend, Gmail integration, Supabase access, Jev pipeline, command-line tools, and tests use Python. The dashboard itself remains plain browser HTML, CSS, and JavaScript—no TypeScript or frontend build step is required.

```bash
uv sync --extra dev
uv run pytest
uv run email-dashboard
```

Useful commands:

```bash
uv run email-gmail-auth
uv run email-ingest
uv run email-ingest --full --resume
uv run email-inspect
uv run email-sample --count 150
```

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

`ghosted` is different from the other categories. It represents the absence of a response over time, so it will be calculated from application history rather than inferred from a single incoming email.

`outreach` covers messages sent to recruiters, hiring managers, referrals, and other contacts to initiate or follow up on a job-search conversation.

## Jev evaluation preparation

The canonical private human-labeled dataset is `data/labeling/generated/labeled-emails.json`. Validate it and rebuild the deterministic development/holdout split with:

```bash
uv run email-jev-prepare
```

The versioned classifier sends four independent questions over the same email state in one TypeSafe request:

- a `Choice` for the seven email categories;
- a `Choice` for the concrete next action, including replying, opening a link, filling a form, scheduling, and completing an assessment;
- a `Score` for urgency;
- a `Noul` for whether a written email draft should be prepared.

`uncertain` is an application policy decision produced when the winning category probability is below `JEV_MIN_TOP_PROBABILITY`; it is not sent as a competing category. A draft is suggested only when the category decision is `reply_needed` and the Noul probability reaches `JEV_DRAFT_REPLY_THRESHOLD`.

After setting `TYPESAFE_API_KEY` in `.env`, run the 39-email held-out evaluation:

```bash
uv run email-jev-evaluate
```

For broader error analysis, run all 199 definitively labeled emails without replacing the held-out report:

```bash
uv run email-jev-evaluate --all-labeled
```

This larger result is diagnostic rather than a clean generalization estimate because it includes the 160 development examples. Those emails are used to improve and version the criteria; they are not dumped into each Jev request. The 39 held-out emails are never supplied as reference examples. The benchmark UI dataset selector keeps both reports available.

The evaluator imports the same classifier function and question configuration that production will call. It records the returned model version, full probability distributions, confidence, raw accuracy, automatic coverage, automatic-only accuracy, per-category results, and token usage. Run `uv run email-dashboard` and open **Evaluate Jev** to inspect the report. Saved results from an older classifier version are marked stale rather than mixed with the current benchmark.

The existing 200 human labels define email-category ground truth only. Therefore, the benchmark scores the category Choice and clearly displays next-action, urgency, and draft-needed outputs as unscored. Those fields need separate human labels before their accuracy can be claimed. The single offer example remains in development, so the first held-out report cannot measure offer accuracy.

## Durable classification data

Phase 5 adds versioned classifier records, frozen classification runs, immutable per-email results, append-only human-label history, review cases, and read views for the dashboard. Browser roles have no direct access; server code uses the Supabase service role.

After applying migrations `002` and `003`, import the existing private labels and register the current benchmarked classifier with:

```bash
uv run email-phase5-bootstrap
```

The bootstrap is idempotent. Repeating it imports zero duplicate labels. It stores the benchmark summary but does not upload the private per-email benchmark result bodies.

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

Local secrets belong in `.env` and must never be committed. The expected variable names will be added in Phase 1 through a safe `.env.example` containing placeholders only.

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
