import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  countUnreadNotifications,
  subscribeToNotifications,
} from '../lib/notifications';
import { useAuth } from './AuthContext';

type NotificationsContextValue = {
  unreadCount: number;
  refresh: () => Promise<void>;
  markOneRead: () => void;
  markAllRead: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue>({
  unreadCount: 0,
  refresh: async () => {},
  markOneRead: () => {},
  markAllRead: () => {},
});

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const userId = user?.id ?? session?.user?.id ?? null;
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    try {
      setUnreadCount(await countUnreadNotifications(userId));
    } catch (e) {
      console.error('NotificationsContext refresh:', e);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    void refresh();
    return subscribeToNotifications(userId, refresh);
  }, [userId, refresh]);

  const markOneRead = useCallback(() => {
    setUnreadCount((count) => Math.max(0, count - 1));
  }, []);

  const markAllRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const value = useMemo(
    () => ({ unreadCount, refresh, markOneRead, markAllRead }),
    [unreadCount, refresh, markOneRead, markAllRead]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
