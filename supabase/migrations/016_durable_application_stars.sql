begin;

-- A star follows an email that identifies the opportunity, not a derived
-- application row. If reclassification changes grouping, publication moves the
-- star to the new application containing this anchor email.
alter table public.emails
  add column if not exists application_starred_at timestamptz;

with latest_starred_email as (
  select distinct on (application.id)
    application.id as application_id,
    email.id as email_id,
    application.starred_at
  from public.applications as application
  join public.application_messages as link on link.application_id = application.id
  join public.emails as email on email.id = link.email_id
  where application.is_starred = true
  order by application.id, email.internal_date desc, email.id desc
)
update public.emails as email
set application_starred_at = anchor.starred_at
from latest_starred_email as anchor
where email.id = anchor.email_id
  and email.application_starred_at is null;

create index if not exists emails_application_starred_idx
  on public.emails (gmail_account_id, application_starred_at desc)
  where application_starred_at is not null;

create or replace function public.set_application_star(
  p_application_id uuid,
  p_starred boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  anchor_email_id uuid;
  starred_time timestamptz := case when p_starred then now() else null end;
  saved public.applications;
begin
  if p_application_id is null then
    raise exception 'application id is required';
  end if;

  perform 1 from public.applications where id = p_application_id for update;
  if not found then
    raise exception 'application not found';
  end if;

  -- Clear every previous anchor inside this application first. This makes
  -- unstar deterministic and ensures a starred opportunity has one canonical
  -- Gmail destination even after repeated toggles.
  update public.emails as email
  set application_starred_at = null
  from public.application_messages as link
  where link.application_id = p_application_id
    and email.id = link.email_id;

  if p_starred then
    select email.id
    into anchor_email_id
    from public.application_messages as link
    join public.emails as email on email.id = link.email_id
    where link.application_id = p_application_id
    order by email.internal_date desc, email.id desc
    limit 1;

    if anchor_email_id is null then
      raise exception 'cannot star an application without email evidence';
    end if;

    update public.emails
    set application_starred_at = starred_time
    where id = anchor_email_id;
  end if;

  update public.applications
  set is_starred = p_starred,
      starred_at = starred_time
  where id = p_application_id
  returning * into saved;

  return jsonb_build_object(
    'id', saved.id,
    'is_starred', saved.is_starred,
    'starred_at', saved.starred_at,
    'anchor_email_id', anchor_email_id
  );
end;
$$;

revoke all on function public.set_application_star(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_application_star(uuid, boolean)
  to service_role;

comment on column public.emails.application_starred_at is
  'Durable opportunity-star anchor. Application publication transfers the star to the current group containing this email.';
comment on function public.set_application_star(uuid, boolean) is
  'Atomically updates the application star and its latest-email anchor so reclassification can preserve the intent on the correct regrouped application.';

notify pgrst, 'reload schema';

commit;
