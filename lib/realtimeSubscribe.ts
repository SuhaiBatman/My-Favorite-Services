import { AppState, type AppStateStatus } from 'react-native';
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import { supabase } from './supabase';

const MAX_RETRIES = 4;
const RETRY_BASE_MS = 1500;

type SubscribeConfig = {
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  schema?: string;
  table: string;
  filter?: string;
  onEvent: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
};

function channelTopic(channelName: string): string {
  return `realtime:${channelName}`;
}

function removeExistingChannel(channelName: string) {
  const topic = channelTopic(channelName);
  const existing = supabase.getChannels().find((ch) => ch.topic === topic);
  if (existing) {
    void supabase.removeChannel(existing);
  }
}

function logSubscribeIssue(label: string, status: string, err?: Error, attempt?: number) {
  if (status === 'SUBSCRIBED') return;
  if (status === 'CLOSED') return;

  const detail = err?.message ?? err ?? '(no details)';
  const suffix = attempt != null ? ` (attempt ${attempt}/${MAX_RETRIES})` : '';

  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    if (__DEV__) {
      console.warn(`[realtime] ${label} ${status}${suffix}: ${detail}`);
    }
    return;
  }

  if (__DEV__) {
    console.info(`[realtime] ${label} ${status}${suffix}`);
  }
}

export function syncRealtimeAuth(accessToken: string | null | undefined) {
  supabase.realtime.setAuth(accessToken ?? null);
}

let appStateListenerAttached = false;
const reconnectListeners = new Set<() => void>();

export function onRealtimeReconnect(listener: () => void): () => void {
  reconnectListeners.add(listener);
  ensureAppStateListener();
  return () => {
    reconnectListeners.delete(listener);
  };
}

function ensureAppStateListener() {
  if (appStateListenerAttached) return;
  appStateListenerAttached = true;

  let lastState: AppStateStatus = AppState.currentState;
  AppState.addEventListener('change', (nextState) => {
    const becameActive = lastState !== 'active' && nextState === 'active';
    lastState = nextState;
    if (becameActive) {
      reconnectListeners.forEach((listener) => listener());
    }
  });
}

export function subscribeToPostgresChanges(
  channelName: string,
  config: SubscribeConfig,
  label: string
): () => void {
  removeExistingChannel(channelName);

  let cancelled = false;
  let channel: RealtimeChannel | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const subscribe = () => {
    if (cancelled) return;

    if (channel) {
      void supabase.removeChannel(channel);
      channel = null;
    }

    channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: config.event,
          schema: config.schema ?? 'public',
          table: config.table,
          filter: config.filter,
        },
        config.onEvent
      )
      .subscribe((status, err) => {
        logSubscribeIssue(label, status, err, attempt + 1);

        if (status === 'SUBSCRIBED') {
          attempt = 0;
          return;
        }

        if (
          cancelled ||
          (status !== 'CHANNEL_ERROR' && status !== 'TIMED_OUT')
        ) {
          return;
        }

        if (attempt >= MAX_RETRIES) {
          return;
        }

        attempt += 1;
        clearRetry();
        retryTimer = setTimeout(subscribe, RETRY_BASE_MS * attempt);
      });
  };

  subscribe();

  return () => {
    cancelled = true;
    clearRetry();
    if (channel) {
      void supabase.removeChannel(channel);
      channel = null;
    }
  };
}

export function subscribeToTableChanges(
  channelName: string,
  table: string,
  onChange: () => void,
  label: string,
  filter?: string
): () => void {
  return subscribeToPostgresChanges(
    channelName,
    {
      event: '*',
      table,
      filter,
      onEvent: () => onChange(),
    },
    label
  );
}
