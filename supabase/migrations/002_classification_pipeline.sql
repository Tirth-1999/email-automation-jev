begin;

create table public.classifier_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'retired')),
  model_requested text not null,
  question_config jsonb not null,
  composition_policy jsonb not null default '{}'::jsonb,
  source_dataset_version text not null,
  reference_config jsonb not null default '{}'::jsonb,
  benchmark_summary jsonb,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classifier_versions_question_config_object
    check (jsonb_typeof(question_config) = 'object'),
  constraint classifier_versions_composition_policy_object
    check (jsonb_typeof(composition_policy) = 'object'),
  constraint classifier_versions_reference_config_object
    check (jsonb_typeof(reference_config) = 'object'),
  constraint classifier_versions_benchmark_summary_object
    check (benchmark_summary is null or jsonb_typeof(benchmark_summary) = 'object'),
  constraint classifier_versions_approval_consistent
    check (status <> 'approved' or approved_at is not null)
);

create table public.classification_runs (
  id uuid primary key default gen_random_uuid(),
  gmail_account_id uuid not null references public.gmail_accounts(id) on delete cascade,
  classifier_version_id uuid not null references public.classifier_versions(id),
  run_kind text not null
    check (run_kind in ('benchmark', 'diagnostic', 'production', 'reprocess')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled')),
  model_requested text not null,
  selection jsonb not null default '{}'::jsonb,
  minimum_top_probability numeric(6, 5) not null default 0.6
    check (minimum_top_probability between 0 and 1),
  concurrency integer not null default 5
    check (concurrency between 1 and 100),
  batch_size integer not null default 25
    check (batch_size between 1 and 1000),
  total_count integer not null default 0 check (total_count >= 0),
  processed_count integer not null default 0 check (processed_count >= 0),
  succeeded_count integer not null default 0 check (succeeded_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  uncertain_count integer not null default 0 check (uncertain_count >= 0),
  cancellation_requested_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classification_runs_selection_object
    check (jsonb_typeof(selection) = 'object'),
  constraint classification_runs_counts_consistent
    check (
      processed_count <= total_count
      and succeeded_count + failed_count <= processed_count
      and uncertain_count <= succeeded_count
    ),
  constraint classification_runs_dates_consistent
    check (finished_at is null or started_at is null or finished_at >= started_at)
);

create table public.email_classification_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.classification_runs(id) on delete cascade,
  email_id uuid not null references public.emails(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  category text
    check (category is null or category in ('applied', 'outreach', 'reply_needed', 'interview_assessment', 'offer', 'rejected', 'other')),
  category_decision text
    check (category_decision is null or category_decision in ('applied', 'outreach', 'reply_needed', 'interview_assessment', 'offer', 'rejected', 'other', 'uncertain')),
  category_confidence numeric(7, 6)
    check (category_confidence is null or category_confidence between 0 and 1),
  category_top_probability numeric(7, 6)
    check (category_top_probability is null or category_top_probability between 0 and 1),
  category_probabilities jsonb,
  next_action text
    check (next_action is null or next_action in ('no_action', 'write_reply', 'open_link', 'fill_form', 'schedule_interview', 'complete_assessment', 'send_document', 'review_offer')),
  action_confidence numeric(7, 6)
    check (action_confidence is null or action_confidence between 0 and 1),
  action_probabilities jsonb,
  urgency_score numeric(7, 6)
    check (urgency_score is null or urgency_score between 0 and 4),
  urgency_confidence numeric(7, 6)
    check (urgency_confidence is null or urgency_confidence between 0 and 1),
  urgency_probabilities jsonb,
  draft_probability numeric(7, 6)
    check (draft_probability is null or draft_probability between 0 and 1),
  should_draft boolean,
  model_returned text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  error_message text,
  started_at timestamptz,
  classified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_classification_results_run_email_unique unique (run_id, email_id),
  constraint email_classification_results_category_probabilities_object
    check (category_probabilities is null or jsonb_typeof(category_probabilities) = 'object'),
  constraint email_classification_results_action_probabilities_object
    check (action_probabilities is null or jsonb_typeof(action_probabilities) = 'object'),
  constraint email_classification_results_urgency_probabilities_object
    check (urgency_probabilities is null or jsonb_typeof(urgency_probabilities) = 'object'),
  constraint email_classification_results_success_complete
    check (
      status <> 'succeeded'
      or (
        category is not null
        and category_decision is not null
        and category_confidence is not null
        and category_top_probability is not null
        and category_probabilities is not null
        and next_action is not null
        and action_confidence is not null
        and action_probabilities is not null
        and urgency_score is not null
        and urgency_confidence is not null
        and urgency_probabilities is not null
        and draft_probability is not null
        and should_draft is not null
        and model_returned is not null
        and input_tokens is not null
        and classified_at is not null
      )
    ),
  constraint email_classification_results_failure_has_error
    check (status <> 'failed' or error_message is not null)
);

create table public.email_human_label_events (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references public.emails(id) on delete cascade,
  category text
    check (category is null or category in ('applied', 'outreach', 'reply_needed', 'interview_assessment', 'offer', 'rejected', 'other', 'uncertain')),
  next_action text
    check (next_action is null or next_action in ('no_action', 'write_reply', 'open_link', 'fill_form', 'schedule_interview', 'complete_assessment', 'send_document', 'review_offer')),
  urgency_level text
    check (urgency_level is null or urgency_level in ('none', 'low', 'normal', 'high', 'immediate')),
  draft_needed boolean,
  source text not null
    check (source in ('review_ui', 'board_override', 'llm_review_confirmation')),
  reviewer_id uuid,
  reviewer_label text,
  notes text not null default '',
  supersedes_event_id uuid references public.email_human_label_events(id),
  created_at timestamptz not null default now(),
  constraint email_human_label_events_has_judgment
    check (category is not null or next_action is not null or urgency_level is not null or draft_needed is not null),
  constraint email_human_label_events_not_self_superseding
    check (supersedes_event_id is null or supersedes_event_id <> id)
);

create table public.classification_review_cases (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references public.emails(id) on delete cascade,
  classification_result_id uuid references public.email_classification_results(id) on delete set null,
  reason text not null
    check (reason in ('low_confidence', 'human_disagreement', 'manual_override', 'processing_issue')),
  status text not null default 'pending'
    check (status in ('pending', 'llm_requested', 'llm_completed', 'resolved', 'dismissed')),
  jev_snapshot jsonb not null,
  llm_provider text,
  llm_model text,
  llm_prompt_version text,
  llm_suggestion jsonb,
  llm_input_tokens integer check (llm_input_tokens is null or llm_input_tokens >= 0),
  llm_output_tokens integer check (llm_output_tokens is null or llm_output_tokens >= 0),
  llm_error_message text,
  final_label_event_id uuid references public.email_human_label_events(id),
  reviewer_id uuid,
  reviewer_label text,
  resolution_notes text not null default '',
  requested_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classification_review_cases_jev_snapshot_object
    check (jsonb_typeof(jev_snapshot) = 'object'),
  constraint classification_review_cases_llm_suggestion_object
    check (llm_suggestion is null or jsonb_typeof(llm_suggestion) = 'object'),
  constraint classification_review_cases_resolution_consistent
    check (
      (status = 'resolved' and resolved_at is not null and final_label_event_id is not null)
      or (status = 'dismissed' and resolved_at is not null)
      or status in ('pending', 'llm_requested', 'llm_completed')
    )
);

create index classifier_versions_status_idx
  on public.classifier_versions (status, created_at desc);

create index classification_runs_account_created_idx
  on public.classification_runs (gmail_account_id, created_at desc);

create index classification_runs_status_created_idx
  on public.classification_runs (status, created_at desc);

create index email_classification_results_run_status_idx
  on public.email_classification_results (run_id, status, created_at);

create index email_classification_results_email_created_idx
  on public.email_classification_results (email_id, created_at desc);

create index email_human_label_events_email_created_idx
  on public.email_human_label_events (email_id, created_at desc, id desc);

create index classification_review_cases_status_created_idx
  on public.classification_review_cases (status, created_at desc);

create index classification_review_cases_email_created_idx
  on public.classification_review_cases (email_id, created_at desc);

create trigger classifier_versions_set_updated_at
before update on public.classifier_versions
for each row execute function public.set_updated_at();

create trigger classification_runs_set_updated_at
before update on public.classification_runs
for each row execute function public.set_updated_at();

create trigger email_classification_results_set_updated_at
before update on public.email_classification_results
for each row execute function public.set_updated_at();

create trigger classification_review_cases_set_updated_at
before update on public.classification_review_cases
for each row execute function public.set_updated_at();

create or replace function public.refresh_classification_run_counters(p_run_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.classification_runs as run
  set
    total_count = counts.total_count,
    processed_count = counts.processed_count,
    succeeded_count = counts.succeeded_count,
    failed_count = counts.failed_count,
    uncertain_count = counts.uncertain_count
  from (
    select
      count(*)::integer as total_count,
      count(*) filter (where status in ('succeeded', 'failed', 'cancelled'))::integer as processed_count,
      count(*) filter (where status = 'succeeded')::integer as succeeded_count,
      count(*) filter (where status = 'failed')::integer as failed_count,
      count(*) filter (where status = 'succeeded' and category_decision = 'uncertain')::integer as uncertain_count
    from public.email_classification_results
    where run_id = p_run_id
  ) as counts
  where run.id = p_run_id;
$$;

create view public.latest_email_classifications
with (security_invoker = true)
as
select distinct on (result.email_id)
  result.*,
  run.gmail_account_id,
  run.run_kind,
  run.classifier_version_id,
  version.version as classifier_version
from public.email_classification_results as result
join public.classification_runs as run on run.id = result.run_id
join public.classifier_versions as version on version.id = run.classifier_version_id
where result.status = 'succeeded'
  and run.status in ('succeeded', 'partial')
  and run.run_kind in ('production', 'reprocess')
order by result.email_id, result.classified_at desc, result.id desc;

create view public.latest_email_human_labels
with (security_invoker = true)
as
select distinct on (event.email_id)
  event.*
from public.email_human_label_events as event
order by event.email_id, event.created_at desc, event.id desc;

create view public.classification_run_summary
with (security_invoker = true)
as
select
  run.*,
  version.version as classifier_version,
  case
    when run.total_count = 0 then 0
    else round((run.processed_count::numeric / run.total_count::numeric) * 100, 2)
  end as progress_percent
from public.classification_runs as run
join public.classifier_versions as version on version.id = run.classifier_version_id;

create view public.email_board_items
with (security_invoker = true)
as
select
  email.id as email_id,
  email.gmail_account_id,
  email.gmail_message_id,
  email.gmail_thread_id,
  email.internal_date,
  email.direction,
  email.from_name,
  email.from_email,
  email.subject,
  email.snippet,
  classification.id as classification_result_id,
  classification.run_id,
  classification.classifier_version,
  classification.category as jev_category,
  classification.category_decision as jev_decision,
  classification.category_confidence,
  classification.category_top_probability,
  classification.next_action,
  classification.urgency_score,
  classification.draft_probability,
  classification.should_draft,
  label.id as human_label_event_id,
  label.category as human_category,
  coalesce(label.category, classification.category_decision) as effective_category,
  label.next_action as human_next_action,
  label.urgency_level as human_urgency_level,
  label.draft_needed as human_draft_needed
from public.emails as email
left join public.latest_email_classifications as classification
  on classification.email_id = email.id
left join public.latest_email_human_labels as label
  on label.email_id = email.id
where email.deleted_at is null;

alter table public.classifier_versions enable row level security;
alter table public.classification_runs enable row level security;
alter table public.email_classification_results enable row level security;
alter table public.email_human_label_events enable row level security;
alter table public.classification_review_cases enable row level security;

revoke all on public.classifier_versions from anon, authenticated;
revoke all on public.classification_runs from anon, authenticated;
revoke all on public.email_classification_results from anon, authenticated;
revoke all on public.email_human_label_events from anon, authenticated;
revoke all on public.classification_review_cases from anon, authenticated;
revoke all on public.latest_email_classifications from anon, authenticated;
revoke all on public.latest_email_human_labels from anon, authenticated;
revoke all on public.classification_run_summary from anon, authenticated;
revoke all on public.email_board_items from anon, authenticated;
revoke all on function public.refresh_classification_run_counters(uuid) from public, anon, authenticated;

grant all on public.classifier_versions to service_role;
grant all on public.classification_runs to service_role;
grant all on public.email_classification_results to service_role;
grant all on public.email_human_label_events to service_role;
grant all on public.classification_review_cases to service_role;
grant select on public.latest_email_classifications to service_role;
grant select on public.latest_email_human_labels to service_role;
grant select on public.classification_run_summary to service_role;
grant select on public.email_board_items to service_role;
grant execute on function public.refresh_classification_run_counters(uuid) to service_role;

comment on table public.email_classification_results is
  'One historical Jev result per email and frozen classification run. Completed rows are treated as immutable by application code.';

comment on table public.email_human_label_events is
  'Append-only human ground truth. Corrections insert a new event and reference the event they supersede.';

commit;
