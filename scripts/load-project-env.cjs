/**
 * Loads env by profile:
 *   local      → `.env.local` (optional shared `.env` base)
 *   production → `.env.production` (optional shared `.env` base)
 *
 * Set APP_ENV=local|production before loading (see scripts/run-env.mjs).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const PROFILE_FILES = {
  local: '.env.local',
  production: '.env.production',
};

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const vars = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

function resolveProfile(profile = process.env.APP_ENV) {
  if (profile === 'production') return 'production';
  // EAS Build sets EAS_BUILD_PROFILE but not APP_ENV unless configured in eas.json.
  const easProfile = process.env.EAS_BUILD_PROFILE;
  if (easProfile === 'production' || easProfile === 'preview') {
    return 'production';
  }
  return 'local';
}

function getProfileEnvPath(profile) {
  return path.join(root, PROFILE_FILES[resolveProfile(profile)]);
}

function loadProjectEnv(profile = process.env.APP_ENV) {
  const resolved = resolveProfile(profile);
  const shared = parseEnvFile(path.join(root, '.env'));
  const profileEnv = parseEnvFile(getProfileEnvPath(resolved));
  return { ...shared, ...profileEnv, _profile: resolved };
}

function resolveSupabaseEnv(profile = process.env.APP_ENV) {
  const env = loadProjectEnv(profile);
  // EAS injects EXPO_PUBLIC_* via eas.json / dashboard; .env.production is not on build servers.
  return {
    EXPO_PUBLIC_SUPABASE_URL:
      env.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    EXPO_PUBLIC_SUPABASE_KEY:
      env.EXPO_PUBLIC_SUPABASE_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY || '',
    EXPO_PUBLIC_SUPABASE_USE_LOCAL:
      env.EXPO_PUBLIC_SUPABASE_USE_LOCAL || process.env.EXPO_PUBLIC_SUPABASE_USE_LOCAL || '',
  };
}

module.exports = {
  loadProjectEnv,
  resolveSupabaseEnv,
  parseEnvFile,
  resolveProfile,
  getProfileEnvPath,
  root,
};
