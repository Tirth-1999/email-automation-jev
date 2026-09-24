begin;

alter table public.application_company_resolutions
  add column if not exists previous_company text,
  add column if not exists previous_role text,
  add column if not exists promoted_company_at timestamptz,
  add column if not exists promoted_title_at timestamptz;

create or replace function public.promote_high_confidence_application_identities(
  p_minimum_score numeric default 0.90
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  company_count integer := 0;
  title_count integer := 0;
begin
  if p_minimum_score < 0 or p_minimum_score > 1 then
    raise exception 'minimum score must be between 0 and 1';
  end if;

  update public.application_company_resolutions as resolution
  set previous_company = application.company
  from public.applications as application
  where application.id = resolution.application_id
    and resolution.promoted_company_at is null
    and resolution.status in ('succeeded', 'uncertain')
    and resolution.employer_name is not null
    and resolution.employer_confidence > p_minimum_score
    and resolution.employer_top_probability > p_minimum_score;

  update public.applications as application
  set company = resolution.employer_name
  from public.application_company_resolutions as resolution
  where application.id = resolution.application_id
    and resolution.promoted_company_at is null
    and resolution.status in ('succeeded', 'uncertain')
    and resolution.employer_name is not null
    and resolution.employer_confidence > p_minimum_score
    and resolution.employer_top_probability > p_minimum_score;
  get diagnostics company_count = row_count;

  update public.application_company_resolutions
  set promoted_company_at = now()
  where promoted_company_at is null
    and status in ('succeeded', 'uncertain')
    and employer_name is not null
    and employer_confidence > p_minimum_score
    and employer_top_probability > p_minimum_score;

  update public.application_company_resolutions as resolution
  set previous_role = application.role
  from public.applications as application
  where application.id = resolution.application_id
    and resolution.promoted_title_at is null
    and resolution.status in ('succeeded', 'uncertain')
    and resolution.title_name is not null
    and resolution.title_confidence > p_minimum_score
    and resolution.title_top_probability > p_minimum_score;

  update public.applications as application
  set role = resolution.title_name
  from public.application_company_resolutions as resolution
  where application.id = resolution.application_id
    and resolution.promoted_title_at is null
    and resolution.status in ('succeeded', 'uncertain')
    and resolution.title_name is not null
    and resolution.title_confidence > p_minimum_score
    and resolution.title_top_probability > p_minimum_score;
  get diagnostics title_count = row_count;

  update public.application_company_resolutions
  set promoted_title_at = now()
  where promoted_title_at is null
    and status in ('succeeded', 'uncertain')
    and title_name is not null
    and title_confidence > p_minimum_score
    and title_top_probability > p_minimum_score;

  return jsonb_build_object(
    'minimum_score', p_minimum_score,
    'companies_promoted', company_count,
    'titles_promoted', title_count
  );
end;
$$;

revoke all on function public.promote_high_confidence_application_identities(numeric) from public, anon, authenticated;
grant execute on function public.promote_high_confidence_application_identities(numeric) to service_role;

comment on function public.promote_high_confidence_application_identities(numeric) is
  'Promotes independently resolved company and title values only when both Choice confidence and winning probability exceed the threshold; preserves previous values in staging.';

notify pgrst, 'reload schema';

commit;
