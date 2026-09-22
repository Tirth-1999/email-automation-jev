begin;

create extension if not exists pgcrypto;

create table public.gmail_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  gmail_address text not null unique,
  latest_history_id text,
  last_synced_at timestamptz,
  sync_status text not null default 'idle'
    check (sync_status in ('idle', 'running', 'error')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.emails (
  id uuid primary key default gen_random_uuid(),
  gmail_account_id uuid not null references public.gmail_accounts(id) on delete cascade,
  gmail_message_id text not null,
  gmail_thread_id text not null,
  rfc_message_id text,
  gmail_history_id text,
  internal_date timestamptz not null,
  direction text not null default 'incoming'
    check (direction in ('incoming', 'outgoing', 'unknown')),
  from_name text,
  from_email text,
  to_recipients jsonb not null default '[]'::jsonb,
  cc_recipients jsonb not null default '[]'::jsonb,
  subject text not null default '',
  snippet text not null default '',
  body_text text not null default '',
  body_html text not null default '',
  label_ids text[] not null default '{}',
  attachment_metadata jsonb not null default '[]'::jsonb,
  raw_headers jsonb not null default '{}'::jsonb,
  size_estimate integer,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint emails_account_message_unique
    unique (gmail_account_id, gmail_message_id)
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  gmail_account_id uuid not null references public.gmail_accounts(id) on delete cascade,
  sync_type text not null
    check (sync_type in ('full', 'incremental', 'recovery_full')),
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  discovered_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  deleted_count integer not null default 0,
  skipped_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index emails_account_date_idx
  on public.emails (gmail_account_id, internal_date desc);

create index emails_account_thread_idx
  on public.emails (gmail_account_id, gmail_thread_id);

create index emails_active_idx
  on public.emails (gmail_account_id, internal_date desc)
  where deleted_at is null;

create index sync_runs_account_started_idx
  on public.sync_runs (gmail_account_id, started_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger gmail_accounts_set_updated_at
before update on public.gmail_accounts
for each row execute function public.set_updated_at();

create trigger emails_set_updated_at
before update on public.emails
for each row execute function public.set_updated_at();

alter table public.gmail_accounts enable row level security;
alter table public.emails enable row level security;
alter table public.sync_runs enable row level security;

revoke all on public.gmail_accounts from anon, authenticated;
revoke all on public.emails from anon, authenticated;
revoke all on public.sync_runs from anon, authenticated;

grant all on public.gmail_accounts to service_role;
grant all on public.emails to service_role;
grant all on public.sync_runs to service_role;

commit;
