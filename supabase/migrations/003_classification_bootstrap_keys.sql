begin;

alter table public.email_human_label_events
  add column source_key text,
  add constraint email_human_label_events_source_key_unique unique (source_key);

create or replace function public.prevent_terminal_classification_result_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('succeeded', 'failed', 'cancelled') then
    raise exception 'Completed classification results are immutable';
  end if;
  return new;
end;
$$;

create trigger email_classification_results_terminal_immutable
before update on public.email_classification_results
for each row execute function public.prevent_terminal_classification_result_update();

create or replace function public.prevent_human_label_event_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Human label events are append-only';
end;
$$;

create trigger email_human_label_events_append_only
before update on public.email_human_label_events
for each row execute function public.prevent_human_label_event_update();

revoke all on function public.prevent_terminal_classification_result_update() from public, anon, authenticated;
revoke all on function public.prevent_human_label_event_update() from public, anon, authenticated;

comment on column public.email_human_label_events.source_key is
  'Optional stable idempotency key for imports and external review events.';

comment on trigger email_human_label_events_append_only on public.email_human_label_events is
  'Corrections insert a new event; existing human decisions cannot be edited in place.';

commit;
