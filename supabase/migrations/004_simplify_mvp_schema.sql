begin;

-- The MVP needs five tables: Gmail accounts, emails, sync runs,
-- classification runs, and per-email classifications. Human labels are current
-- email attributes; classifier configuration is frozen directly on each run.

drop view if exists public.email_board_items;
drop view if exists public.classification_run_summary;
drop view if exists public.latest_email_human_labels;
drop view if exists public.latest_email_classifications;

alter table public.emails
  add column human_category text
    check (human_category is null or human_category in ('applied', 'outreach', 'reply_needed', 'interview_assessment', 'offer', 'rejected', 'other', 'uncertain')),
  add column human_next_action text
    check (human_next_action is null or human_next_action in ('no_action', 'write_reply', 'open_link', 'fill_form', 'schedule_interview', 'complete_assessment', 'send_document', 'review_offer')),
  add column human_urgency_level text
    check (human_urgency_level is null or human_urgency_level in ('none', 'low', 'normal', 'high', 'immediate')),
  add column human_draft_needed boolean,
  add column human_label_source text,
  add column human_label_source_key text,
  add column human_label_notes text not null default '',
  add column human_labeled_at timestamptz;

with latest_label as (
  select distinct on (event.email_id)
    event.email_id,
    event.category,
    event.next_action,
    event.urgency_level,
    event.draft_needed,
    event.source,
    event.source_key,
    event.notes,
    event.created_at
  from public.email_human_label_events as event
  order by event.email_id, event.created_at desc, event.id desc
)
update public.emails as email
set
  human_category = label.category,
  human_next_action = label.next_action,
  human_urgency_level = label.urgency_level,
  human_draft_needed = label.draft_needed,
  human_label_source = label.source,
  human_label_source_key = label.source_key,
  human_label_notes = label.notes,
  human_labeled_at = label.created_at
from latest_label as label
where email.id = label.email_id;

alter table public.classification_runs
  add column classifier_version text,
  add column classifier_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(classifier_config) = 'object');

update public.classification_runs as run
set
  classifier_version = version.version,
  classifier_config = jsonb_build_object(
    'question_config', version.question_config,
    'composition_policy', version.composition_policy,
    'source_dataset_version', version.source_dataset_version,
    'reference_config', version.reference_config,
    'benchmark_summary', version.benchmark_summary
  )
from public.classifier_versions as version
where run.classifier_version_id = version.id;

alter table public.classification_runs
  alter column classifier_version set not null,
  drop column classifier_version_id;

drop table public.classification_review_cases;
drop table public.email_human_label_events;
drop table public.classifier_versions;
drop function public.prevent_human_label_event_update();

alter table public.email_classification_results rename to email_classifications;
alter table public.email_classifications
  rename constraint email_classification_results_run_email_unique to email_classifications_run_email_unique;
alter table public.email_classifications
  rename constraint email_classification_results_category_probabilities_object to email_classifications_category_probabilities_object;
alter table public.email_classifications
  rename constraint email_classification_results_action_probabilities_object to email_classifications_action_probabilities_object;
alter table public.email_classifications
  rename constraint email_classification_results_urgency_probabilities_object to email_classifications_urgency_probabilities_object;
alter table public.email_classifications
  rename constraint email_classification_results_success_complete to email_classifications_success_complete;
alter table public.email_classifications
  rename constraint email_classification_results_failure_has_error to email_classifications_failure_has_error;

alter index public.email_classification_results_run_status_idx rename to email_classifications_run_status_idx;
alter index public.email_classification_results_email_created_idx rename to email_classifications_email_created_idx;
alter trigger email_classification_results_set_updated_at on public.email_classifications
  rename to email_classifications_set_updated_at;
alter trigger email_classification_results_terminal_immutable on public.email_classifications
  rename to email_classifications_terminal_immutable;
alter function public.prevent_terminal_classification_result_update()
  rename to prevent_terminal_email_classification_update;

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
    from public.email_classifications
    where run_id = p_run_id
  ) as counts
  where run.id = p_run_id;
$$;

create view public.email_board
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
  classification.id as classification_id,
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
  email.human_category,
  email.human_next_action,
  email.human_urgency_level,
  email.human_draft_needed,
  email.human_label_source,
  email.human_label_notes,
  email.human_labeled_at,
  coalesce(email.human_category, classification.category_decision) as effective_category
from public.emails as email
left join lateral (
  select
    result.*,
    run.classifier_version
  from public.email_classifications as result
  join public.classification_runs as run on run.id = result.run_id
  where result.email_id = email.id
    and result.status = 'succeeded'
    and run.status in ('succeeded', 'partial')
    and run.run_kind in ('production', 'reprocess')
  order by result.classified_at desc, result.id desc
  limit 1
) as classification on true
where email.deleted_at is null;

revoke all on public.email_board from anon, authenticated;
grant select on public.email_board to service_role;
revoke all on function public.refresh_classification_run_counters(uuid) from public, anon, authenticated;
grant execute on function public.refresh_classification_run_counters(uuid) to service_role;

comment on table public.email_classifications is
  'Per-email queue state and Jev output for each durable classification run.';
comment on view public.email_board is
  'Single dashboard read model: email metadata, latest Jev result, and current human override.';
comment on column public.classification_runs.classifier_config is
  'Frozen classifier configuration for this run; avoids a separate version registry table.';

commit;
