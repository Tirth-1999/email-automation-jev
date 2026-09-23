begin;

-- Starred is a personal board tag, not an application lifecycle status.
alter table public.applications
  add column if not exists is_starred boolean not null default false,
  add column if not exists starred_at timestamptz;

-- Keep only the current AI review on the email row. This avoids another table
-- while retaining the exact structured input/output needed for inspection.
alter table public.emails
  add column if not exists llm_review_category text
    check (llm_review_category is null or llm_review_category in ('applied', 'outreach', 'reply_needed', 'interview_assessment', 'offer', 'rejected', 'other', 'uncertain')),
  add column if not exists llm_review_confidence numeric(5,4)
    check (llm_review_confidence is null or (llm_review_confidence >= 0 and llm_review_confidence <= 1)),
  add column if not exists llm_review_should_override boolean,
  add column if not exists llm_review_input jsonb,
  add column if not exists llm_review_output jsonb,
  add column if not exists llm_review_model text,
  add column if not exists llm_reviewed_at timestamptz;

create index if not exists applications_starred_idx
  on public.applications (gmail_account_id, starred_at desc)
  where is_starred;

comment on column public.applications.is_starred is
  'Personal follow-up tag. A starred application remains in its lifecycle lane and is also shown in Starred.';
comment on column public.emails.llm_review_output is
  'Current structured second-stage LLM review. Jev and human decisions remain independently auditable.';

notify pgrst, 'reload schema';

commit;
