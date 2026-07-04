import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import {
  describeSupabaseKey,
  getLocalSupabaseHostForDev,
  isHostedSupabaseConfig,
  isLocalSupabase,
  resolveSupabaseAnonKey,
  resolveSupabaseUrl,
} from './supabaseConfig';

const supabaseUrl = resolveSupabaseUrl();
const supabaseAnonKey = resolveSupabaseAnonKey();

if (!supabaseUrl || !supabaseAnonKey) {
  const message =
    '[supabase] Missing URL or anon key. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY in .env, run `npm run supabase-env:sync`, then restart Metro (npx expo start -c).';
  throw new Error(message);
}

if (__DEV__) {
  const mode = isLocalSupabase() ? 'local' : isHostedSupabaseConfig() ? 'hosted' : 'custom';
  const extra = isLocalSupabase() ? ` (Mac LAN: ${getLocalSupabaseHostForDev()})` : '';
  console.info(
    `[supabase] ${mode} → ${supabaseUrl || '(missing URL)'} | key: ${describeSupabaseKey(supabaseAnonKey)}${extra}`
  );
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      '[supabase] Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY in .env, then restart Metro (npx expo start -c).'
    );
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
