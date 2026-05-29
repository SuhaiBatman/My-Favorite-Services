import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  LOCAL_SUPABASE_API_URL,
  LOCAL_SUPABASE_HOST,
} from '../constants/generated/supabase-host';

/** Supabase CLI local API port (see `supabase/config.toml`). */
export const LOCAL_SUPABASE_API_PORT = 54321;

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
    return envUrl ?? '';
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
  return process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim() ?? '';
}

export function shouldUseLocalSupabase(envUrl?: string): boolean {
  const url = envUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
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
