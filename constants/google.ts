/**
 * Google OAuth client IDs (public in the client app — not secret).
 * Set EXPO_PUBLIC_GOOGLE_* in `.env` or EAS environment variables.
 */

export function getGoogleWebClientId(): string {
  return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';
}

export function getGoogleAndroidClientId(): string {
  return process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() ?? '';
}

/** Comma-separated list for Supabase Dashboard → Auth → Google → Client IDs */
export function getGoogleSupabaseClientIds(): string {
  const web = getGoogleWebClientId();
  const android = getGoogleAndroidClientId();
  return [web, android].filter(Boolean).join(',');
}
