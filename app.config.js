/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json');
const { syncSupabaseEnv } = require('./scripts/write-supabase-env.cjs');
const { loadProjectEnv, resolveProfile } = require('./scripts/load-project-env.cjs');
const {
  HOSTED_SUPABASE_PUBLISHABLE_KEY,
  HOSTED_SUPABASE_URL,
} = require('./scripts/supabase-production.cjs');

const profile = resolveProfile(process.env.APP_ENV);
process.env.APP_ENV = profile;

const projectEnv = loadProjectEnv(profile);
for (const [key, value] of Object.entries(projectEnv)) {
  if (!key.startsWith('_') && value) {
    process.env[key] = value;
  }
}

const supabaseEnv = syncSupabaseEnv({ profile, quiet: true });

const hostedUrl =
  supabaseEnv.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  HOSTED_SUPABASE_URL;
const hostedKey =
  supabaseEnv.EXPO_PUBLIC_SUPABASE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||
  (profile === 'production' ? HOSTED_SUPABASE_PUBLISHABLE_KEY : '');

process.env.EXPO_PUBLIC_SUPABASE_URL = hostedUrl;
process.env.EXPO_PUBLIC_SUPABASE_KEY = hostedKey;
if (supabaseEnv.EXPO_PUBLIC_SUPABASE_USE_LOCAL) {
  process.env.EXPO_PUBLIC_SUPABASE_USE_LOCAL = supabaseEnv.EXPO_PUBLIC_SUPABASE_USE_LOCAL;
}

function googleIosUrlScheme() {
  const scheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim();
  if (scheme) return scheme;

  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (iosClientId?.endsWith('.apps.googleusercontent.com')) {
    const id = iosClientId.replace('.apps.googleusercontent.com', '');
    return `com.googleusercontent.apps.${id}`;
  }

  return null;
}

const plugins = appJson.expo.plugins.filter(
  (plugin) =>
    plugin !== '@react-native-google-signin/google-signin' &&
    !(Array.isArray(plugin) && plugin[0] === '@react-native-google-signin/google-signin')
);

const iosUrlScheme = googleIosUrlScheme();
if (iosUrlScheme) {
  plugins.push([
    '@react-native-google-signin/google-signin',
    { iosUrlScheme },
  ]);
}

module.exports = {
  expo: {
    ...appJson.expo,
    plugins,
    extra: {
      ...appJson.expo.extra,
      // Baked from `.env.local` or `.env.production` (APP_ENV) — see scripts/run-env.mjs
      supabaseUrl: hostedUrl,
      supabaseAnonKey: hostedKey,
      supabaseUseLocal: supabaseEnv.EXPO_PUBLIC_SUPABASE_USE_LOCAL,
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '',
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
    },
  },
};
