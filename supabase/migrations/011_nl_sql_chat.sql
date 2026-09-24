begin;

create or replace function public.execute_ai_readonly_sql(
  p_gmail_account_id uuid,
  p_sql text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_sql text := btrim(p_sql);
  scoped_sql text;
  result jsonb;
begin
  if normalized_sql = '' or length(normalized_sql) > 5000 then
    raise exception 'AI SQL is empty or too long';
  end if;
  if normalized_sql !~* '^(select|with)\M' then
    raise exception 'Only SELECT queries are permitted';
  end if;
  if position(';' in normalized_sql) > 0 or normalized_sql ~ '(--|/\*)' then
    raise exception 'SQL comments and multiple statements are not permitted';
  end if;
  if position(':gmail_account_id' in normalized_sql) = 0 then
    raise exception 'Account scope placeholder is required';
  end if;
  if normalized_sql ~* '\m(insert|update|delete|merge|alter|drop|create|truncate|grant|revoke|copy|execute|call|do|vacuum|analyze|refresh|set|reset|listen|notify)\M' then
    raise exception 'Forbidden SQL operation';
  end if;
  if normalized_sql ~* '\m(pg_catalog|information_schema|auth|storage|vault|pg_read_file|dblink|current_setting|set_config)\M' then
    raise exception 'Forbidden SQL schema or function';
  end if;
  if normalized_sql ~* '\m(gmail_accounts|emails|rag_documents)\M' then
    raise exception 'Relation is not available to AI Chat';
  end if;

  perform set_config('statement_timeout', '5000', true);
  scoped_sql := replace(normalized_sql, ':gmail_account_id', quote_literal(p_gmail_account_id));
  execute format(
    'select coalesce(jsonb_agg(to_jsonb(ai_row)), ''[]''::jsonb) from (select * from (%s) ai_source limit 200) ai_row',
    scoped_sql
  ) into result;
  return coalesce(result, '[]'::jsonb);
end;
$$;

revoke all on function public.execute_ai_readonly_sql(uuid, text) from public, anon, authenticated;
grant execute on function public.execute_ai_readonly_sql(uuid, text) to service_role;

comment on function public.execute_ai_readonly_sql(uuid, text) is
  'Executes one validated, account-scoped, read-only AI Chat query and returns at most 200 JSON rows.';

notify pgrst, 'reload schema';

commit;
