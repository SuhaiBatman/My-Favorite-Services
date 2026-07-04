import { supabase } from './supabase';
import { subscribeToTableChanges } from './realtimeSubscribe';

export type NotificationType =
  | 'new_appointment'
  | 'appointment_confirmed'
  | 'appointment_declined'
  | 'appointment_rescheduled'
  | 'reschedule_requested'
  | 'reschedule_accepted'
  | 'reschedule_declined'
  | 'new_client';

export type AppNotification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

function normalizeNotification(row: AppNotification): AppNotification {
  return {
    ...row,
    data: (row.data ?? {}) as Record<string, unknown>,
  };
}

export async function listNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, type, title, body, data, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []).map((row) => normalizeNotification(row as AppNotification));
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null);

  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .not('read_at', 'is', null);

  if (error) throw error;
}

export function subscribeToNotifications(userId: string, onChange: () => void) {
  return subscribeToTableChanges(
    `notifications:${userId}`,
    'notifications',
    onChange,
    `notifications for ${userId}`,
    `user_id=eq.${userId}`
  );
}
