begin;

alter table public.emails
  add column reply_draft_subject text,
  add column reply_draft_body text,
  add column reply_draft_instructions text,
  add column reply_draft_provider text,
  add column reply_draft_model text,
  add column reply_draft_generated_at timestamptz;

comment on column public.emails.human_category is
  'Current human correction. The original Jev result remains unchanged in email_classifications.';
comment on column public.emails.reply_draft_body is
  'Current LLM-generated draft for human review. The application never sends it automatically.';

commit;
