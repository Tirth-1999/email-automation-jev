begin;

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  gmail_account_id uuid not null references public.gmail_accounts(id) on delete cascade,
  grouping_key text not null,
  company text,
  role text,
  requisition_id text,
  current_status text not null default 'applied'
    check (current_status in ('outreach', 'applied', 'reply_needed', 'interview_assessment', 'offer', 'rejected', 'ghosted')),
  first_activity_at timestamptz not null,
  last_activity_at timestamptz not null,
  ghosted_at timestamptz,
  grouping_source text not null default 'deterministic'
    check (grouping_source in ('deterministic', 'manual')),
  manual_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_account_grouping_unique unique (gmail_account_id, grouping_key),
  constraint applications_activity_dates_valid check (last_activity_at >= first_activity_at)
);

create table public.application_messages (
  application_id uuid not null references public.applications(id) on delete cascade,
  email_id uuid not null references public.emails(id) on delete cascade,
  association_source text not null default 'deterministic'
    check (association_source in ('deterministic', 'manual')),
  association_confidence numeric(5,4) not null default 1
    check (association_confidence >= 0 and association_confidence <= 1),
  created_at timestamptz not null default now(),
  primary key (application_id, email_id),
  constraint application_messages_email_unique unique (email_id)
);

create table public.application_status_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  email_id uuid references public.emails(id) on delete cascade,
  status text not null
    check (status in ('outreach', 'applied', 'reply_needed', 'interview_assessment', 'offer', 'rejected', 'ghosted')),
  event_at timestamptz not null,
  source text not null default 'email_classification'
    check (source in ('email_classification', 'human_correction', 'ghosting_rule', 'manual')),
  explanation text not null default '',
  created_at timestamptz not null default now(),
  constraint application_status_event_unique unique nulls not distinct (application_id, email_id, status)
);

create index applications_account_status_idx
  on public.applications (gmail_account_id, current_status, last_activity_at desc);
create index application_messages_email_idx
  on public.application_messages (email_id);
create index application_status_events_application_date_idx
  on public.application_status_events (application_id, event_at, id);

create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

create view public.application_board
with (security_invoker = true)
as
select
  application.*,
  counts.message_count,
  counts.event_count,
  counts.actionable_count,
  counts.latest_email_id,
  counts.latest_subject,
  counts.latest_sender,
  counts.latest_next_action,
  counts.latest_confidence
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

alter table public.applications enable row level security;
alter table public.application_messages enable row level security;
alter table public.application_status_events enable row level security;

revoke all on public.applications from anon, authenticated;
revoke all on public.application_messages from anon, authenticated;
revoke all on public.application_status_events from anon, authenticated;
revoke all on public.application_board from anon, authenticated;

grant all on public.applications to service_role;
grant all on public.application_messages to service_role;
grant all on public.application_status_events to service_role;
grant select on public.application_board to service_role;

comment on table public.applications is
  'One durable job application or recruiting opportunity, grouped from related email evidence.';
comment on table public.application_messages is
  'One-to-one assignment of a job-related email to an application, with manual override support.';
comment on table public.application_status_events is
  'Appendable lifecycle evidence used to derive current status and Sankey transitions.';
comment on view public.application_board is
  'Application-level dashboard read model with compact latest-email and backlog fields.';

commit;
