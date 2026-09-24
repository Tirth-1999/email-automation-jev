begin;

-- Migration 015 installed the account-scoped classification reset. Extend it
-- so a clean rebuild also removes manual application grouping/status authority,
-- while deliberately retaining the durable email-level star anchor from 016.
create or replace function public.reset_account_classification_state(
  p_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  run_count integer := 0;
  result_count integer := 0;
  override_count integer := 0;
  application_count integer := 0;
  manual_link_count integer := 0;
  manual_event_count integer := 0;
begin
  if p_account_id is null then
    raise exception 'gmail account id is required';
  end if;

  if exists (
    select 1
    from public.classification_runs
    where gmail_account_id = p_account_id
      and status in ('queued', 'running')
  ) then
    raise exception 'cannot reset classification state while a run is queued or running';
  end if;

  select count(*)::integer into result_count
  from public.email_classifications as result
  join public.classification_runs as run on run.id = result.run_id
  where run.gmail_account_id = p_account_id;

  select count(*)::integer into run_count
  from public.classification_runs
  where gmail_account_id = p_account_id;

  select count(*)::integer into override_count
  from public.emails
  where gmail_account_id = p_account_id
    and (
      human_category is not null
      or human_next_action is not null
      or human_urgency_level is not null
      or human_draft_needed is not null
      or human_label_source is not null
      or llm_review_category is not null
      or llm_review_output is not null
    );

  delete from public.classification_runs
  where gmail_account_id = p_account_id;

  update public.emails
  set
    human_category = null,
    human_next_action = null,
    human_urgency_level = null,
    human_draft_needed = null,
    human_label_source = null,
    human_label_source_key = null,
    human_label_notes = '',
    human_labeled_at = null,
    llm_review_category = null,
    llm_review_confidence = null,
    llm_review_should_override = null,
    llm_review_input = null,
    llm_review_output = null,
    llm_review_model = null,
    llm_reviewed_at = null
  where gmail_account_id = p_account_id;

  delete from public.application_messages as link
  using public.applications as application
  where link.application_id = application.id
    and application.gmail_account_id = p_account_id
    and link.association_source = 'manual';
  get diagnostics manual_link_count = row_count;

  delete from public.application_status_events as event
  using public.applications as application
  where event.application_id = application.id
    and application.gmail_account_id = p_account_id
    and event.source = 'manual';
  get diagnostics manual_event_count = row_count;

  update public.applications
  set grouping_source = 'deterministic',
      manual_notes = ''
  where gmail_account_id = p_account_id
    and (grouping_source = 'manual' or manual_notes <> '');
  get diagnostics application_count = row_count;

  return jsonb_build_object(
    'classification_runs_deleted', run_count,
    'classification_results_deleted', result_count,
    'email_overrides_cleared', override_count,
    'applications_reset', application_count,
    'manual_links_deleted', manual_link_count,
    'manual_events_deleted', manual_event_count
  );
end;
$$;

revoke all on function public.reset_account_classification_state(uuid)
  from public, anon, authenticated;
grant execute on function public.reset_account_classification_state(uuid)
  to service_role;

comment on function public.reset_account_classification_state(uuid) is
  'Explicit clean rebuild: removes account classification history and manual decision authority while preserving source email, drafts, application star anchors, and private label files.';

notify pgrst, 'reload schema';

commit;
