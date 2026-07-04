import os from 'node:os';
import { execSync } from 'node:child_process';

const METRO_PORT = Number(process.env.RCT_METRO_PORT || process.env.METRO_PORT || 8081);

/** Apple tethering / link-local — deprioritized vs real LAN or localhost. */
const DEPRIORITIZED_HOST = [/^192\.0\.0\.\d+$/, /^169\.254\./];

const PRIVATE_IPV4 = [
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
];

/**
 * @returns {{ name: string, address: string }[]}
 */
export function listIPv4Candidates() {
  const candidates = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (!addrs) continue;
    for (const addr of addrs) {
      const family = addr.family;
      if (family !== 'IPv4' && family !== 4) continue;
      if (addr.internal) continue;
      candidates.push({ name, address: addr.address });
    }
  }
  return candidates;
}

/**
 * @param {string} address
 */
export function scoreIPv4Address(address) {
  if (DEPRIORITIZED_HOST.some((re) => re.test(address))) return 10;
  if (PRIVATE_IPV4.some((re) => re.test(address))) return 100;
  return 50;
}

/**
 * Best LAN IPv4 for a physical device to reach Metro on this machine.
 * @returns {string}
 */
export function pickLanIPv4() {
  const ranked = listIPv4Candidates()
    .map((entry) => ({ ...entry, score: scoreIPv4Address(entry.address) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return ranked[0]?.address ?? 'localhost';
}

/**
 * @returns {boolean}
 */
export function hasBootedIOSSimulator() {
  try {
    const output = execSync('xcrun simctl list devices booted', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return /\((Booted)\)/.test(output);
  } catch {
    return false;
  }
}

/**
 * Expo `--device` values for simulators (e.g. "iPhone 17 Pro"), not UDIDs.
 * @param {string | undefined} device
 */
export function isSimulatorDeviceName(device) {
  if (!device) return false;
  if (/^[0-9A-F-]{36}$/i.test(device)) return false;
  if (/^000080[0-9a-f]+$/i.test(device)) return false;
  return /^(iPhone|iPad|iPod) /i.test(device);
}

/**
 * @param {{
 *   device?: string;
 *   preferSimulator?: boolean;
 *   preferPhysical?: boolean;
 * }} [options]
 * @returns {string} hostname only (no port)
 */
export function resolveMetroHost(options = {}) {
  const { device, preferSimulator = false, preferPhysical = false } = options;

  if (preferPhysical) {
    return pickLanIPv4();
  }

  if (preferSimulator || isSimulatorDeviceName(device)) {
    return 'localhost';
  }

  if (device) {
    return pickLanIPv4();
  }

  if (hasBootedIOSSimulator()) {
    return 'localhost';
  }

  return pickLanIPv4();
}

/**
 * @param {string} host
 */
export function metroBundleUrl(host) {
  return `http://${host}:${METRO_PORT}`;
}

/**
 * Parse `--device` from argv (expo-style).
 * @param {string[]} argv
 */
export function parseDeviceArg(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--device' && argv[i + 1]) {
      return argv[i + 1];
    }
    if (argv[i].startsWith('--device=')) {
      return argv[i].slice('--device='.length);
    }
  }
  return undefined;
}
