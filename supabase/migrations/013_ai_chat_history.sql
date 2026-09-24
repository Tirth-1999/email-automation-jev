begin;

create table public.ai_chat_conversations (
  id uuid primary key default gen_random_uuid(),
  gmail_account_id uuid not null references public.gmail_accounts(id) on delete cascade,
  title text not null default 'New chat' check (char_length(title) between 1 and 120),
  messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages) = 'array'),
  archived_at timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_chat_conversations_account_recent_idx
  on public.ai_chat_conversations (gmail_account_id, archived_at, last_message_at desc);
create trigger ai_chat_conversations_set_updated_at
before update on public.ai_chat_conversations
for each row execute function public.set_updated_at();

alter table public.ai_chat_conversations enable row level security;

revoke all on public.ai_chat_conversations from public, anon, authenticated;
grant all on public.ai_chat_conversations to service_role;

comment on table public.ai_chat_conversations is
  'Durable account-scoped AI Chat sessions with ordered JSON message history. Closing archives instead of deleting.';

notify pgrst, 'reload schema';

commit;
