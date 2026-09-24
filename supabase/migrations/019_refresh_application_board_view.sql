begin;

-- application_board was created before migration 008 added star columns.
-- PostgreSQL expands application.* when a view is created, so refresh the view
-- explicitly and append the newer columns without changing existing positions.
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
  application.starred_at
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

revoke all on public.application_board from public, anon, authenticated;
grant select on public.application_board to service_role;

comment on view public.application_board is
  'Application-level dashboard read model with lifecycle, backlog, and personal star fields.';

notify pgrst, 'reload schema';

commit;
