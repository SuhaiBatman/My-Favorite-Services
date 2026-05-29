import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import {
  getLocalSupabaseHostForDev,
  isLocalSupabase,
  resolveSupabaseAnonKey,
  resolveSupabaseUrl,
} from './supabaseConfig';

const supabaseUrl = resolveSupabaseUrl();
const supabaseAnonKey = resolveSupabaseAnonKey();

if (!supabaseUrl || !supabaseAnonKey) {
  const message =
    '[supabase] Missing URL or anon key. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY.';
  if (__DEV__) {
    console.warn(message + ' For local dev: copy .env.example → .env.local and run `npm run supabase:start`.');
  } else {
    throw new Error(message);
  }
}

if (__DEV__ && isLocalSupabase()) {
  console.info(
    `[supabase] Local API → ${supabaseUrl} (Mac LAN: ${getLocalSupabaseHostForDev()})`
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
