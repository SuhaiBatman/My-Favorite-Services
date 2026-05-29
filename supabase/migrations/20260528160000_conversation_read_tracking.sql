-- Track when each participant last viewed a conversation
alter table public.conversations
  add column if not exists user_last_read_at timestamp with time zone,
  add column if not exists provider_last_read_at timestamp with time zone;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.conversations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_conv
  from public.conversations
  where id = p_conversation_id;

  if not found then
    return;
  end if;

  if auth.uid() = v_conv.user_id then
    update public.conversations
    set user_last_read_at = timezone('utc', now())
    where id = p_conversation_id;
  elsif auth.uid() = v_conv.provider_id then
    update public.conversations
    set provider_last_read_at = timezone('utc', now())
    where id = p_conversation_id;
  end if;
end;
$$;

grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Inbox lists update live when messages arrive or read state changes
alter publication supabase_realtime add table public.conversations;
