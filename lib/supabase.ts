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

if (__DEV__ && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn(
    '[supabase] Missing EXPO_PUBLIC_SUPABASE_KEY. ' +
      'For local dev: copy .env.example → .env.local and run `npm run supabase:start`.'
  );
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
