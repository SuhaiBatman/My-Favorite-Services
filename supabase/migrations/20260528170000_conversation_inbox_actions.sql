-- Per-participant inbox controls (pin, mute, archive) and conversation delete

alter table public.conversations
  add column if not exists user_is_pinned boolean not null default false,
  add column if not exists user_is_muted boolean not null default false,
  add column if not exists user_is_archived boolean not null default false,
  add column if not exists provider_is_pinned boolean not null default false,
  add column if not exists provider_is_muted boolean not null default false,
  add column if not exists provider_is_archived boolean not null default false;

create or replace function public.mark_conversation_unread(p_conversation_id uuid)
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
    set user_last_read_at = null
    where id = p_conversation_id;
  elsif auth.uid() = v_conv.provider_id then
    update public.conversations
    set provider_last_read_at = null
    where id = p_conversation_id;
  end if;
end;
$$;

grant execute on function public.mark_conversation_unread(uuid) to authenticated;

create or replace function public.set_conversation_inbox_flag(
  p_conversation_id uuid,
  p_flag text,
  p_value boolean
)
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

  if p_flag not in ('pinned', 'muted', 'archived') then
    raise exception 'Invalid flag: %', p_flag;
  end if;

  select * into v_conv
  from public.conversations
  where id = p_conversation_id;

  if not found then
    return;
  end if;

  if auth.uid() = v_conv.user_id then
    if p_flag = 'pinned' then
      update public.conversations set user_is_pinned = p_value where id = p_conversation_id;
    elsif p_flag = 'muted' then
      update public.conversations set user_is_muted = p_value where id = p_conversation_id;
    else
      update public.conversations set user_is_archived = p_value where id = p_conversation_id;
    end if;
  elsif auth.uid() = v_conv.provider_id then
    if p_flag = 'pinned' then
      update public.conversations set provider_is_pinned = p_value where id = p_conversation_id;
    elsif p_flag = 'muted' then
      update public.conversations set provider_is_muted = p_value where id = p_conversation_id;
    else
      update public.conversations set provider_is_archived = p_value where id = p_conversation_id;
    end if;
  end if;
end;
$$;

grant execute on function public.set_conversation_inbox_flag(uuid, text, boolean) to authenticated;

create policy "Participants can delete conversations"
  on public.conversations for delete
  using (auth.uid() = user_id or auth.uid() = provider_id);

grant delete on public.conversations to authenticated;
