#!/usr/bin/env node
/** @deprecated Use scripts/run-env.mjs */
import { spawn } from 'child_process';

const args = process.argv.slice(2);
const child = spawn('node', ['scripts/run-env.mjs', 'local', 'start', ...args], {
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 0));
