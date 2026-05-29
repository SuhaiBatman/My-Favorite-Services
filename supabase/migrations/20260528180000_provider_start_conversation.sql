-- Allow employees (providers) to start or open a conversation with a client user
create or replace function public.get_or_create_conversation_as_provider(p_user_id uuid)
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

  if auth.uid() = p_user_id then
    raise exception 'Cannot message yourself';
  end if;

  select id into v_conversation_id
  from public.conversations
  where user_id = p_user_id and provider_id = auth.uid();

  if v_conversation_id is null then
    insert into public.conversations (user_id, provider_id)
    values (p_user_id, auth.uid())
    returning id into v_conversation_id;
  end if;

  return v_conversation_id;
end;
$$;

grant execute on function public.get_or_create_conversation_as_provider(uuid) to authenticated;
