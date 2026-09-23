begin;

-- Phase 11 deliberately reuses gmail_accounts for the one-account scheduler
-- lease and latest health snapshot. No additional operational table is needed;
-- sync_runs and classification_runs already hold detailed execution history.
alter table public.gmail_accounts
  add column pipeline_lock_id uuid,
  add column pipeline_lock_expires_at timestamptz,
  add column last_automation_started_at timestamptz,
  add column last_automation_completed_at timestamptz,
  add column last_automation_status text
    check (last_automation_status is null or last_automation_status in ('running', 'succeeded', 'failed', 'skipped')),
  add column last_automation_error text,
  add column last_automation_metrics jsonb not null default '{}'::jsonb
    check (jsonb_typeof(last_automation_metrics) = 'object');

alter table public.emails
  add column reply_draft_status text
    check (reply_draft_status is null or reply_draft_status in ('suggested', 'reviewed')),
  add column reply_draft_reviewed_at timestamptz;

create or replace function public.try_acquire_pipeline_lock(
  p_account_id uuid,
  p_lock_id uuid,
  p_ttl_seconds integer default 10800
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  acquired boolean := false;
begin
  if p_ttl_seconds < 60 or p_ttl_seconds > 21600 then
    raise exception 'Pipeline lock TTL must be between 60 and 21600 seconds';
  end if;

  update public.gmail_accounts as account
  set
    pipeline_lock_id = p_lock_id,
    pipeline_lock_expires_at = now() + make_interval(secs => p_ttl_seconds),
    last_automation_started_at = now(),
    last_automation_completed_at = null,
    last_automation_status = 'running',
    last_automation_error = null,
    last_automation_metrics = '{}'::jsonb
  where account.id = p_account_id
    and (account.pipeline_lock_id is null or account.pipeline_lock_expires_at <= now())
    and account.sync_status <> 'running'
    and not exists (
      select 1
      from public.classification_runs as run
      where run.gmail_account_id = p_account_id
        and run.status in ('queued', 'running')
    )
  returning true into acquired;

  return coalesce(acquired, false);
end;
$$;

create or replace function public.release_pipeline_lock(
  p_account_id uuid,
  p_lock_id uuid,
  p_status text,
  p_error text default null,
  p_metrics jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  released boolean := false;
begin
  if p_status not in ('succeeded', 'failed', 'skipped') then
    raise exception 'Invalid terminal automation status';
  end if;
  if jsonb_typeof(coalesce(p_metrics, '{}'::jsonb)) <> 'object' then
    raise exception 'Automation metrics must be a JSON object';
  end if;

  update public.gmail_accounts as account
  set
    pipeline_lock_id = null,
    pipeline_lock_expires_at = null,
    last_automation_completed_at = now(),
    last_automation_status = p_status,
    last_automation_error = left(p_error, 2000),
    last_automation_metrics = coalesce(p_metrics, '{}'::jsonb)
  where account.id = p_account_id
    and account.pipeline_lock_id = p_lock_id
  returning true into released;

  return coalesce(released, false);
end;
$$;

revoke all on function public.try_acquire_pipeline_lock(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.release_pipeline_lock(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.try_acquire_pipeline_lock(uuid, uuid, integer) to service_role;
grant execute on function public.release_pipeline_lock(uuid, uuid, text, text, jsonb) to service_role;

comment on function public.try_acquire_pipeline_lock(uuid, uuid, integer) is
  'Atomically prevents overlapping scheduled, Gmail-sync, and Jev-classification work for one account.';
comment on column public.gmail_accounts.last_automation_metrics is
  'Body-free summary of the latest scheduled pipeline cycle for Command Center observability.';
comment on column public.emails.reply_draft_status is
  'Current suggested reply state. Reviewed still requires explicit sending outside this application.';

commit;
