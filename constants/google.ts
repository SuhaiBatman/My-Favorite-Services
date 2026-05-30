/**
 * Google OAuth client IDs (public — safe to embed in the app).
 *
 * - WEB: passed to GoogleSignin.configure() — required for idToken on Android/iOS.
 * - ANDROID: registered in Google Cloud with package + SHA-1; add to Supabase Auth → Google → Client IDs.
 */
export const GOOGLE_WEB_CLIENT_ID =
  '674563099428-te031jnic99kdf4iel4k92if5m91vaqu.apps.googleusercontent.com';

export const GOOGLE_ANDROID_CLIENT_ID =
  '674563099428-10bcqnfrk8cvsjcq0mu89dtug89ta219.apps.googleusercontent.com';

/** Comma-separated list for Supabase Dashboard → Auth → Google → Client IDs */
export const GOOGLE_SUPABASE_CLIENT_IDS = `${GOOGLE_WEB_CLIENT_ID},${GOOGLE_ANDROID_CLIENT_ID}`;
