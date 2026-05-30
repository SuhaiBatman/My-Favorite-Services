import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  CLOUD_SUPABASE_ANON_KEY,
  CLOUD_SUPABASE_URL,
} from '../constants/supabase-cloud';
import {
  LOCAL_SUPABASE_API_URL,
  LOCAL_SUPABASE_HOST,
} from '../constants/generated/supabase-host';

/** Supabase CLI local API port (see `supabase/config.toml`). */
export const LOCAL_SUPABASE_API_PORT = 54321;

/** Local `supabase start` demo anon JWT (iss: supabase-demo). */
const LOCAL_DEMO_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

function isLocalDemoAnonKey(key: string): boolean {
  if (key.startsWith('sb_publishable_')) return false;
  try {
    const payload = JSON.parse(atob(key.split('.')[1] ?? ''));
    return payload.iss === 'supabase-demo';
  } catch {
    return false;
  }
}

/**
 * Resolves the Supabase API URL for the current runtime.
 *
 * Local dev (`EXPO_PUBLIC_SUPABASE_USE_LOCAL=true`):
 * - LAN IP is auto-detected on your Mac via `scripts/lan-host.mjs` (updates on Wi‑Fi change).
 * - iOS Simulator → 127.0.0.1
 * - Android Emulator → 10.0.2.2
 * - Physical device / Expo Go on phone → Mac LAN IP from generated file
 *
 * Production: set `EXPO_PUBLIC_SUPABASE_USE_LOCAL=false` and cloud URL in `.env`.
 */
export function resolveSupabaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const useLocal = shouldUseLocalSupabase(envUrl);

  if (!useLocal) {
    return envUrl || CLOUD_SUPABASE_URL;
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
  const envKey = process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim();

  if (!shouldUseLocalSupabase()) {
    // `.env.local` often overrides EXPO_PUBLIC_SUPABASE_KEY with the local demo JWT.
    if (envKey && !isLocalDemoAnonKey(envKey)) {
      return envKey;
    }
    return CLOUD_SUPABASE_ANON_KEY;
  }

  return envKey || LOCAL_DEMO_ANON_KEY;
}

export function shouldUseLocalSupabase(envUrl?: string): boolean {
  // Release builds must never hit a dev-machine LAN IP baked into generated files.
  if (!__DEV__) {
    return false;
  }

  if (process.env.EXPO_PUBLIC_SUPABASE_FORCE_LOCAL === 'true') {
    return true;
  }

  const url = envUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

  // Google OAuth (and other providers) must use hosted Supabase — local auth on Android
  // emulator resolves to 10.0.2.2:54321, which the in-app browser cannot complete.
  if (url.includes('.supabase.co')) {
    return false;
  }

  return (
    process.env.EXPO_PUBLIC_SUPABASE_USE_LOCAL === 'true' ||
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
