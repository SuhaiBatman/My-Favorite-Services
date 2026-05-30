import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  LOCAL_SUPABASE_API_URL,
  LOCAL_SUPABASE_HOST,
} from '../constants/localSupabaseHost';
import {
  SUPABASE_ANON_KEY as BAKED_ANON_KEY,
  SUPABASE_URL as BAKED_URL,
  SUPABASE_USE_LOCAL as BAKED_USE_LOCAL,
} from '../constants/supabaseEnv';

/** Supabase CLI local API port (see `supabase/config.toml`). */
export const LOCAL_SUPABASE_API_PORT = 54321;

/** Local `supabase start` demo anon JWT (iss: supabase-demo). */
export const LOCAL_DEMO_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

/** Baked env from app.config / postinstall; beats Metro .env.local overrides. */
function envUrl(): string {
  return BAKED_URL.trim() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
}

function envKey(): string {
  return BAKED_ANON_KEY.trim() || process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim() || '';
}

function envUseLocalFlag(): string {
  return (
    BAKED_USE_LOCAL.trim() || process.env.EXPO_PUBLIC_SUPABASE_USE_LOCAL?.trim() || ''
  );
}

export function isLocalDemoAnonKey(key: string): boolean {
  if (!key || key.startsWith('sb_publishable_') || key.startsWith('sb_secret_')) {
    return false;
  }
  try {
    const payload = JSON.parse(atob(key.split('.')[1] ?? ''));
    return payload.iss === 'supabase-demo';
  } catch {
    return false;
  }
}

/** Hosted project URL or platform publishable/secret keys → must not use local API. */
export function isHostedSupabaseConfig(): boolean {
  const url = envUrl();
  const key = envKey();
  if (url.includes('.supabase.co')) return true;
  if (key.startsWith('sb_publishable_') || key.startsWith('sb_secret_')) return true;
  return false;
}

export function describeSupabaseKey(key: string): string {
  if (!key) return 'missing';
  if (key.startsWith('sb_publishable_')) return 'publishable';
  if (key.startsWith('sb_secret_')) return 'secret';
  if (isLocalDemoAnonKey(key)) return 'local-demo';
  if (key.startsWith('eyJ')) return 'anon-jwt';
  return 'unknown';
}

/**
 * Resolves the Supabase API URL for the current runtime.
 *
 * Local dev (`EXPO_PUBLIC_SUPABASE_USE_LOCAL=true` in `.env.local`):
 * - LAN IP is auto-detected on your Mac via `scripts/lan-host.mjs` (updates on Wi‑Fi change).
 * - iOS Simulator → 127.0.0.1
 * - Android Emulator → 10.0.2.2
 * - Physical device / Expo Go on phone → Mac LAN IP from generated file
 *
 * Production: use `.env.production` via `npm run android:prod` (see scripts/run-env.mjs).
 */
export function resolveSupabaseUrl(): string {
  const url = envUrl();
  const useLocal = shouldUseLocalSupabase(url);

  if (!useLocal) {
    return url;
  }

  if (Platform.OS === 'web') {
    return `http://127.0.0.1:${LOCAL_SUPABASE_API_PORT}`;
  }

  if (Platform.OS === 'ios' && !Constants.isDevice) {
    return `http://127.0.0.1:${LOCAL_SUPABASE_API_PORT}`;
  }

  if (Platform.OS === 'android' && !Constants.isDevice) {
    return `http://10.0.2.2:${LOCAL_SUPABASE_API_PORT}`;
  }

  return LOCAL_SUPABASE_API_URL;
}

export function resolveSupabaseAnonKey(): string {
  const key = envKey();
  const useLocal = shouldUseLocalSupabase();

  if (!useLocal) {
    if (key && !isLocalDemoAnonKey(key)) {
      return key;
    }
    return key;
  }

  // Local stack only accepts the demo anon JWT from `supabase start`.
  if (key && !isLocalDemoAnonKey(key)) {
    if (__DEV__) {
      console.warn(
        '[supabase] Local API ignores hosted publishable keys; using the demo anon JWT. Run `npm run supabase:start` or point .env at your cloud project.'
      );
    }
    return LOCAL_DEMO_ANON_KEY;
  }

  return key || LOCAL_DEMO_ANON_KEY;
}

export function shouldUseLocalSupabase(envUrlArg?: string): boolean {
  if (!__DEV__) {
    return false;
  }

  if (isHostedSupabaseConfig()) {
    return false;
  }

  if (process.env.EXPO_PUBLIC_SUPABASE_FORCE_LOCAL === 'true') {
    return true;
  }

  const url = envUrlArg ?? envUrl();

  return (
    envUseLocalFlag() === 'true' ||
    url.includes('127.0.0.1') ||
    url.includes('localhost') ||
    url.includes('10.0.2.2')
  );
}

export function isLocalSupabase(): boolean {
  return shouldUseLocalSupabase();
}

export function getLocalSupabaseHostForDev(): string {
  return LOCAL_SUPABASE_HOST;
}
