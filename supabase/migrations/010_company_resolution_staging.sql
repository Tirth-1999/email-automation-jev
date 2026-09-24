begin;

create table public.application_company_resolutions (
  application_id uuid primary key references public.applications(id) on delete cascade,
  gmail_account_id uuid not null references public.gmail_accounts(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'uncertain', 'failed')),
  context_hash text not null check (length(context_hash) = 64),
  candidate_set jsonb not null default '[]'::jsonb check (jsonb_typeof(candidate_set) = 'array'),
  title_candidate_set jsonb not null default '[]'::jsonb check (jsonb_typeof(title_candidate_set) = 'array'),
  employer_candidate_id text,
  employer_name text,
  employer_confidence numeric(6,5) check (employer_confidence is null or employer_confidence between 0 and 1),
  employer_top_probability numeric(6,5) check (employer_top_probability is null or employer_top_probability between 0 and 1),
  employer_probabilities jsonb not null default '{}'::jsonb check (jsonb_typeof(employer_probabilities) = 'object'),
  title_candidate_id text,
  title_name text,
  title_confidence numeric(6,5) check (title_confidence is null or title_confidence between 0 and 1),
  title_top_probability numeric(6,5) check (title_top_probability is null or title_top_probability between 0 and 1),
  title_probabilities jsonb not null default '{}'::jsonb check (jsonb_typeof(title_probabilities) = 'object'),
  agency_candidate_id text,
  agency_name text,
  agency_confidence numeric(6,5) check (agency_confidence is null or agency_confidence between 0 and 1),
  agency_probabilities jsonb not null default '{}'::jsonb check (jsonb_typeof(agency_probabilities) = 'object'),
  platform_candidate_id text,
  platform_name text,
  platform_confidence numeric(6,5) check (platform_confidence is null or platform_confidence between 0 and 1),
  platform_probabilities jsonb not null default '{}'::jsonb check (jsonb_typeof(platform_probabilities) = 'object'),
  company_needs_llm_review boolean not null default false,
  title_needs_llm_review boolean not null default false,
  needs_llm_review boolean not null default false,
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index application_company_resolutions_account_status_idx
  on public.application_company_resolutions (gmail_account_id, status, updated_at desc);

create trigger application_company_resolutions_set_updated_at
before update on public.application_company_resolutions
for each row execute function public.set_updated_at();

alter table public.application_company_resolutions enable row level security;
revoke all on public.application_company_resolutions from public, anon, authenticated;
grant all on public.application_company_resolutions to service_role;

comment on table public.application_company_resolutions is
  'Temporary audited Jev company-and-title identity staging. It never overwrites applications without a separate promotion step.';

notify pgrst, 'reload schema';

commit;
