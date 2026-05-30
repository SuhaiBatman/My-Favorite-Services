#!/usr/bin/env node
/**
 * Runs Expo commands with profile-specific env (.env.local or .env.production).
 *
 * Usage:
 *   node scripts/run-env.mjs local android
 *   node scripts/run-env.mjs production android
 *   node scripts/run-env.mjs local start
 */
import { spawn, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { createRequire } from 'module';
import { syncLanHost, startLanWatch } from './lan-host.mjs';

const require = createRequire(import.meta.url);
const { syncSupabaseEnv } = require('./write-supabase-env.cjs');
const { loadProjectEnv, resolveProfile, getProfileEnvPath } = require('./load-project-env.cjs');

const VALID_COMMANDS = new Set(['android', 'ios', 'start']);

const profileArg = process.argv[2];
const command = process.argv[3];
const extraArgs = process.argv.slice(4);

if (!profileArg || !VALID_COMMANDS.has(command)) {
  console.error(
    'Usage: node scripts/run-env.mjs <local|production> <android|ios|start> [expo args...]'
  );
  process.exit(1);
}

const profile = resolveProfile(profileArg);
process.env.APP_ENV = profile;

function applyProfileEnv() {
  const profileFile = getProfileEnvPath(profile);
  if (!existsSync(profileFile)) {
    console.warn(
      `[env:${profile}] Missing ${profile === 'local' ? '.env.local' : '.env.production'}. ` +
        `Copy from ${profile === 'local' ? '.env.local.example' : '.env.production.example'}.`
    );
  }

  const merged = loadProjectEnv(profile);
  const supabaseEnv = syncSupabaseEnv({ profile, quiet: false });

  for (const [key, value] of Object.entries(merged)) {
    if (key.startsWith('_') || value === undefined || value === '') continue;
    process.env[key] = value;
  }

  process.env.EXPO_PUBLIC_SUPABASE_URL = supabaseEnv.EXPO_PUBLIC_SUPABASE_URL;
  process.env.EXPO_PUBLIC_SUPABASE_KEY = supabaseEnv.EXPO_PUBLIC_SUPABASE_KEY;
  if (supabaseEnv.EXPO_PUBLIC_SUPABASE_USE_LOCAL) {
    process.env.EXPO_PUBLIC_SUPABASE_USE_LOCAL = supabaseEnv.EXPO_PUBLIC_SUPABASE_USE_LOCAL;
  }

  console.log(`[env:${profile}] Using ${profile === 'local' ? '.env.local' : '.env.production'}`);
}

applyProfileEnv();

function ensureLocalSupabase() {
  if (profile !== 'local') return true;
  console.log('[env:local] Starting Supabase…');
  const start = spawnSync('supabase', ['start'], { stdio: 'inherit', shell: true });
  if (start.status !== 0) return false;

  console.log('[env:local] Applying pending database migrations…');
  const migrate = spawnSync('supabase', ['migration', 'up', '--local'], {
    stdio: 'inherit',
    shell: true,
  });
  return migrate.status === 0;
}

function runExpo(args) {
  return spawn('npx', ['expo', ...args], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
}

if (!ensureLocalSupabase()) {
  process.exit(1);
}

if (profile === 'local') {
  syncLanHost({ quiet: false });
}

let stopWatch = () => {};

if (command === 'start' && profile === 'local') {
  stopWatch = startLanWatch({ intervalMs: 3000 });
}

const expoArgs =
  command === 'start' ? ['start', ...extraArgs] : [`run:${command}`, ...extraArgs];

const child = runExpo(expoArgs);

function shutdown(signal) {
  stopWatch();
  if (!child.killed) child.kill(signal);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

child.on('exit', (code) => {
  stopWatch();
  process.exit(code ?? 0);
});
