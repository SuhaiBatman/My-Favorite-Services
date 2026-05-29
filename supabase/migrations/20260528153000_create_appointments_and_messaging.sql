-- Appointments between users and providers (employees)
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade not null,
  provider_id uuid references public.profiles (id) on delete cascade not null,
  service_name text not null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  status text not null default 'confirmed'
    check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  location text,
  notes text,
  created_at timestamp with time zone default timezone('utc', now()) not null,
  updated_at timestamp with time zone default timezone('utc', now()) not null,
  check (ends_at > starts_at),
  check (user_id <> provider_id)
);

create index if not exists appointments_user_id_starts_at_idx
  on public.appointments (user_id, starts_at);

create index if not exists appointments_provider_id_starts_at_idx
  on public.appointments (provider_id, starts_at);

alter table public.appointments enable row level security;

create policy "Users and providers can view their appointments"
  on public.appointments for select
  using (auth.uid() = user_id or auth.uid() = provider_id);

create policy "Users can create appointments"
  on public.appointments for insert
  with check (auth.uid() = user_id);

create policy "Participants can update appointments"
  on public.appointments for update
  using (auth.uid() = user_id or auth.uid() = provider_id);

-- Conversations (consumer user <-> provider)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade not null,
  provider_id uuid references public.profiles (id) on delete cascade not null,
  last_message_body text,
  last_message_at timestamp with time zone,
  last_message_sender_id uuid references public.profiles (id) on delete set null,
  created_at timestamp with time zone default timezone('utc', now()) not null,
  updated_at timestamp with time zone default timezone('utc', now()) not null,
  unique (user_id, provider_id),
  check (user_id <> provider_id)
);

create index if not exists conversations_user_id_updated_at_idx
  on public.conversations (user_id, updated_at desc);

create index if not exists conversations_provider_id_updated_at_idx
  on public.conversations (provider_id, updated_at desc);

alter table public.conversations enable row level security;

create policy "Participants can view conversations"
  on public.conversations for select
  using (auth.uid() = user_id or auth.uid() = provider_id);

create policy "Users can start conversations"
  on public.conversations for insert
  with check (auth.uid() = user_id);

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations (id) on delete cascade not null,
  sender_id uuid references public.profiles (id) on delete cascade not null,
  body text not null,
  created_at timestamp with time zone default timezone('utc', now()) not null,
  constraint messages_body_length check (char_length(trim(body)) > 0)
);

create index if not exists messages_conversation_id_created_at_idx
  on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;

create policy "Participants can view messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user_id = auth.uid() or c.provider_id = auth.uid())
    )
  );

create policy "Participants can send messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user_id = auth.uid() or c.provider_id = auth.uid())
    )
  );

-- Keep conversation summary in sync for inbox lists
create or replace function public.handle_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    last_message_body = new.body,
    last_message_at = new.created_at,
    last_message_sender_id = new.sender_id,
    updated_at = timezone('utc', now())
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists on_message_created on public.messages;
create trigger on_message_created
  after insert on public.messages
  for each row execute function public.handle_new_message();

-- Get or create a conversation as the authenticated user (consumer)
create or replace function public.get_or_create_conversation(p_provider_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if auth.uid() = p_provider_id then
    raise exception 'Cannot message yourself';
  end if;

  select id into v_conversation_id
  from public.conversations
  where user_id = auth.uid() and provider_id = p_provider_id;

  if v_conversation_id is null then
    insert into public.conversations (user_id, provider_id)
    values (auth.uid(), p_provider_id)
    returning id into v_conversation_id;
  end if;

  return v_conversation_id;
end;
$$;

grant execute on function public.get_or_create_conversation(uuid) to authenticated;

grant select, insert, update on public.appointments to authenticated;
grant select, insert on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;

-- Realtime for live messaging
alter publication supabase_realtime add table public.messages;
