begin;

-- Preserve the last known-good cycle independently from the latest attempt.
-- This stays on gmail_accounts because the dashboard needs one compact health
-- snapshot; sync_runs and classification_runs remain the detailed history.
alter table public.gmail_accounts
  add column if not exists last_automation_succeeded_at timestamptz;

update public.gmail_accounts
set last_automation_succeeded_at = last_automation_completed_at
where last_automation_succeeded_at is null
  and last_automation_status = 'succeeded'
  and last_automation_completed_at is not null;

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
    last_automation_succeeded_at = case
      when p_status = 'succeeded' then now()
      else account.last_automation_succeeded_at
    end,
    last_automation_status = p_status,
    last_automation_error = left(p_error, 2000),
    last_automation_metrics = coalesce(p_metrics, '{}'::jsonb)
  where account.id = p_account_id
    and account.pipeline_lock_id = p_lock_id
  returning true into released;

  return coalesce(released, false);
end;
$$;

revoke all on function public.release_pipeline_lock(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.release_pipeline_lock(uuid, uuid, text, text, jsonb) to service_role;

comment on column public.gmail_accounts.last_automation_succeeded_at is
  'Completion timestamp of the most recent successful scheduled pipeline, preserved across later runs and failures.';

notify pgrst, 'reload schema';

commit;
