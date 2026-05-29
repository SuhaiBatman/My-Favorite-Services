#!/usr/bin/env node
/**
 * Syncs Mac LAN IP for local Supabase, watches for Wi‑Fi changes, then starts Expo.
 */
import { spawn } from 'child_process';
import { startLanWatch } from './lan-host.mjs';

const stopWatch = startLanWatch({ intervalMs: 3000 });

const expoArgs = process.argv.slice(2);
const expo = spawn('npx', ['expo', 'start', ...expoArgs], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    EXPO_PUBLIC_SUPABASE_USE_LOCAL: process.env.EXPO_PUBLIC_SUPABASE_USE_LOCAL ?? 'true',
  },
});

function shutdown(signal) {
  stopWatch();
  if (!expo.killed) expo.kill(signal);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

expo.on('exit', (code) => {
  stopWatch();
  process.exit(code ?? 0);
});
