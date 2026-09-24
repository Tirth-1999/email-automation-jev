begin;

-- This is a personal completion marker for the Interview Assessment lane. It
-- does not change the application's lifecycle status or Jev classification.
alter table public.applications
  add column if not exists interview_progress text
    check (interview_progress is null or interview_progress in ('pending', 'completed')),
  add column if not exists interview_progress_updated_at timestamptz;

create or replace function public.set_application_interview_progress(
  p_application_id uuid,
  p_progress text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  saved public.applications;
begin
  if p_application_id is null then
    raise exception 'application id is required';
  end if;
  if p_progress is not null and p_progress not in ('pending', 'completed') then
    raise exception 'interview progress must be pending, completed, or null';
  end if;

  update public.applications
  set interview_progress = p_progress,
      interview_progress_updated_at = case when p_progress is null then null else now() end
  where id = p_application_id
    and current_status = 'interview_assessment'
  returning * into saved;

  if not found then
    raise exception 'interview assessment application not found';
  end if;

  return jsonb_build_object(
    'id', saved.id,
    'interview_progress', saved.interview_progress,
    'interview_progress_updated_at', saved.interview_progress_updated_at
  );
end;
$$;

-- Append the marker to the existing dashboard view without changing its
-- established column order.
create or replace view public.application_board
with (security_invoker = true)
as
select
  application.id,
  application.gmail_account_id,
  application.grouping_key,
  application.company,
  application.role,
  application.requisition_id,
  application.current_status,
  application.first_activity_at,
  application.last_activity_at,
  application.ghosted_at,
  application.grouping_source,
  application.manual_notes,
  application.created_at,
  application.updated_at,
  counts.message_count,
  counts.event_count,
  counts.actionable_count,
  counts.latest_email_id,
  counts.latest_subject,
  counts.latest_sender,
  counts.latest_next_action,
  counts.latest_confidence,
  application.is_starred,
  application.starred_at,
  application.interview_progress,
  application.interview_progress_updated_at
from public.applications as application
join lateral (
  select
    count(distinct link.email_id)::integer as message_count,
    count(distinct event.id)::integer as event_count,
    count(distinct link.email_id) filter (
      where board.next_action is not null and board.next_action <> 'no_action'
    )::integer as actionable_count,
    (array_agg(board.email_id order by board.internal_date desc))[1] as latest_email_id,
    (array_agg(board.subject order by board.internal_date desc))[1] as latest_subject,
    (array_agg(coalesce(board.from_name, board.from_email) order by board.internal_date desc))[1] as latest_sender,
    (array_agg(board.next_action order by board.internal_date desc))[1] as latest_next_action,
    (array_agg(board.category_top_probability order by board.internal_date desc))[1] as latest_confidence
  from public.application_messages as link
  join public.email_board as board on board.email_id = link.email_id
  left join public.application_status_events as event on event.application_id = application.id
  where link.application_id = application.id
) as counts on true;

revoke all on function public.set_application_interview_progress(uuid, text)
  from public, anon, authenticated;
grant execute on function public.set_application_interview_progress(uuid, text)
  to service_role;
revoke all on public.application_board from public, anon, authenticated;
grant select on public.application_board to service_role;

comment on column public.applications.interview_progress is
  'Personal completion marker shown only on Interview Assessment application cards.';

notify pgrst, 'reload schema';

commit;
