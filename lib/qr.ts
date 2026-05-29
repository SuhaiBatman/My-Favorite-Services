import * as Linking from 'expo-linking';
import { APP_SCHEME } from '../constants/links';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Value encoded in employee QR codes (deep link into the app). */
export function buildProfileQrValue(profileId: string): string {
  return Linking.createURL(`profile/${profileId}`);
}

export function buildProfileDeepLink(profileId: string): string {
  return `${APP_SCHEME}://profile/${profileId}`;
}

/** Extract provider profile id from scanned QR text or an incoming deep link URL. */
export function parseProfileIdFromQr(data: string): string | null {
  const trimmed = data.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as { type?: string; id?: string };
    if (
      parsed?.id &&
      UUID_RE.test(parsed.id) &&
      (parsed.type === 'employee' || parsed.type === 'provider')
    ) {
      return parsed.id.toLowerCase();
    }
  } catch {
    // not JSON
  }

  const profilePath = trimmed.match(/profile\/([0-9a-f-]{36})/i);
  if (profilePath?.[1]) return profilePath[1].toLowerCase();

  const webPath = trimmed.match(/\/p\/([0-9a-f-]{36})/i);
  if (webPath?.[1]) return webPath[1].toLowerCase();

  if (UUID_RE.test(trimmed)) return trimmed.toLowerCase();

  return null;
}
