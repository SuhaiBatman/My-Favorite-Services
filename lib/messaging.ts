import { profileDisplayName } from './format';
import { supabase } from './supabase';

export type ConversationParticipant = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  business_name: string | null;
};

export type ConversationInboxFlags = {
  is_pinned: boolean;
  is_muted: boolean;
  is_archived: boolean;
};

export type Conversation = {
  id: string;
  user_id: string;
  provider_id: string;
  last_message_body: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  user_last_read_at: string | null;
  provider_last_read_at: string | null;
  user_is_pinned: boolean;
  user_is_muted: boolean;
  user_is_archived: boolean;
  provider_is_pinned: boolean;
  provider_is_muted: boolean;
  provider_is_archived: boolean;
  updated_at: string;
  provider?: ConversationParticipant | null;
  user?: ConversationParticipant | null;
};

export type ConversationInboxFlag = 'pinned' | 'muted' | 'archived';

export function getConversationInboxFlags(
  conversation: Conversation,
  participantId: string
): ConversationInboxFlags {
  const isUser = conversation.user_id === participantId;
  return {
    is_pinned: isUser ? conversation.user_is_pinned : conversation.provider_is_pinned,
    is_muted: isUser ? conversation.user_is_muted : conversation.provider_is_muted,
    is_archived: isUser ? conversation.user_is_archived : conversation.provider_is_archived,
  };
}

export function sortConversationsForInbox(
  conversations: Conversation[],
  participantId: string
): Conversation[] {
  return [...conversations].sort((a, b) => {
    const aPinned = getConversationInboxFlags(a, participantId).is_pinned;
    const bPinned = getConversationInboxFlags(b, participantId).is_pinned;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    const aTime = new Date(a.last_message_at || a.updated_at).getTime();
    const bTime = new Date(b.last_message_at || b.updated_at).getTime();
    return bTime - aTime;
  });
}

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type ProviderListItem = ConversationParticipant & {
  industry?: string | null;
  services?: string | null;
  location?: string | null;
};

function normalizeParticipant<T extends ConversationParticipant | null>(
  value: T | T[] | null
): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeConversationRow(
  row: Conversation & {
    provider: ConversationParticipant | ConversationParticipant[] | null;
    user?: ConversationParticipant | ConversationParticipant[] | null;
  }
): Conversation {
  return {
    ...row,
    user_is_pinned: row.user_is_pinned ?? false,
    user_is_muted: row.user_is_muted ?? false,
    user_is_archived: row.user_is_archived ?? false,
    provider_is_pinned: row.provider_is_pinned ?? false,
    provider_is_muted: row.provider_is_muted ?? false,
    provider_is_archived: row.provider_is_archived ?? false,
    provider: normalizeParticipant(row.provider),
    user: normalizeParticipant(row.user ?? null),
  };
}

export function getConversationPeer(
  conversation: Conversation,
  participantId: string
): ConversationParticipant | null {
  if (conversation.user_id === participantId) {
    return conversation.provider ?? null;
  }
  if (conversation.provider_id === participantId) {
    return conversation.user ?? null;
  }
  return conversation.provider ?? conversation.user ?? null;
}

export function isConversationUnreadForParticipant(
  conversation: Conversation,
  participantId: string
): boolean {
  if (
    !conversation.last_message_sender_id ||
    conversation.last_message_sender_id === participantId
  ) {
    return false;
  }
  if (!conversation.last_message_at) {
    return false;
  }

  const lastReadAt =
    conversation.user_id === participantId
      ? conversation.user_last_read_at
      : conversation.provider_id === participantId
        ? conversation.provider_last_read_at
        : null;

  if (!lastReadAt) return true;
  return new Date(conversation.last_message_at) > new Date(lastReadAt);
}

const conversationSelect = `
  id,
  user_id,
  provider_id,
  last_message_body,
  last_message_at,
  last_message_sender_id,
  user_last_read_at,
  provider_last_read_at,
  user_is_pinned,
  user_is_muted,
  user_is_archived,
  provider_is_pinned,
  provider_is_muted,
  provider_is_archived,
  updated_at,
  provider:provider_id (
    id,
    first_name,
    last_name,
    job_title,
    business_name
  )
`;

const conversationSelectWithUser = `
  ${conversationSelect},
  user:user_id (
    id,
    first_name,
    last_name,
    job_title,
    business_name
  )
`;

export async function listProviderConversations(providerId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(conversationSelectWithUser)
    .eq('provider_id', providerId)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) =>
    normalizeConversationRow(
      row as unknown as Conversation & {
        provider: ConversationParticipant | ConversationParticipant[] | null;
        user: ConversationParticipant | ConversationParticipant[] | null;
      }
    )
  );
}

export async function listEmployeeConversations(employeeId: string): Promise<Conversation[]> {
  const [asUser, asProvider] = await Promise.all([
    listUserConversations(employeeId),
    listProviderConversations(employeeId),
  ]);
  const byId = new Map<string, Conversation>();
  for (const c of [...asUser, ...asProvider]) {
    byId.set(c.id, c);
  }
  return sortConversationsForInbox([...byId.values()], employeeId);
}

export async function listUserConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(conversationSelect)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) =>
    normalizeConversationRow(
      row as unknown as Conversation & {
        provider: ConversationParticipant | ConversationParticipant[] | null;
      }
    )
  );
}

export async function listMessageableProviders(): Promise<ProviderListItem[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, job_title, business_name, industry, services, location, role, roles')
    .or('role.eq.employee,roles.cs.{employee}')
    .order('first_name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProviderListItem[];
}

export async function getOrCreateConversation(providerId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_conversation', {
    p_provider_id: providerId,
  });

  if (error) throw error;
  return data as string;
}

export async function getOrCreateConversationAsProvider(userId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_conversation_as_provider', {
    p_user_id: userId,
  });

  if (error) throw error;
  return data as string;
}

export async function listMessageableClients(
  employeeId: string
): Promise<ProviderListItem[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(
      'user:user_id (id, first_name, last_name, job_title, business_name, industry, services, location)'
    )
    .eq('provider_id', employeeId);

  if (error) throw error;

  const byId = new Map<string, ProviderListItem>();
  for (const row of data ?? []) {
    const user = row.user as ProviderListItem | ProviderListItem[] | null;
    const profile = Array.isArray(user) ? user[0] : user;
    if (profile?.id && profile.id !== employeeId) {
      byId.set(profile.id, profile);
    }
  }
  return [...byId.values()].sort((a, b) =>
    profileDisplayName(a.first_name, a.last_name).localeCompare(
      profileDisplayName(b.first_name, b.last_name)
    )
  );
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select(conversationSelect)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return normalizeConversationRow(
    data as unknown as Conversation & {
      provider: ConversationParticipant | ConversationParticipant[] | null;
    }
  );
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string
): Promise<Message> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Message cannot be empty');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: trimmed,
    })
    .select('id, conversation_id, sender_id, body, created_at')
    .single();

  if (error) throw error;
  return data;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  });

  if (error) throw error;
}

export async function markConversationUnread(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_conversation_unread', {
    p_conversation_id: conversationId,
  });

  if (error) throw error;
}

export async function setConversationInboxFlag(
  conversationId: string,
  flag: ConversationInboxFlag,
  value: boolean
): Promise<void> {
  const { error } = await supabase.rpc('set_conversation_inbox_flag', {
    p_conversation_id: conversationId,
    p_flag: flag,
    p_value: value,
  });

  if (error) throw error;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const { error } = await supabase.from('conversations').delete().eq('id', conversationId);

  if (error) throw error;
}

function removeExistingChannel(channelName: string) {
  const topic = `realtime:${channelName}`;
  const existing = supabase.getChannels().find((ch) => ch.topic === topic);
  if (existing) {
    void supabase.removeChannel(existing);
  }
}

export function subscribeToMessages(
  conversationId: string,
  onInsert: (message: Message) => void
) {
  const channelName = `messages:${conversationId}`;
  removeExistingChannel(channelName);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onInsert(payload.new as Message);
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error(`subscribeToMessages failed for ${conversationId}`);
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToConversationUpdates(participantId: string, onChange: () => void) {
  const channelName = `conversations:participant:${participantId}`;
  removeExistingChannel(channelName);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `user_id=eq.${participantId}`,
      },
      () => onChange()
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `provider_id=eq.${participantId}`,
      },
      () => onChange()
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error(`subscribeToConversationUpdates failed for ${participantId}`);
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}
