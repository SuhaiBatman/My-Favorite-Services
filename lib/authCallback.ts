import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

let authCallbackInFlight: string | null = null;
let authCallbackCompleted: string | null = null;

function authCallbackError(message: string): { error: { message: string } } {
  return { error: { message } };
}

/** Deep link used for OAuth, email confirmation, and password recovery. */
export const AUTH_CALLBACK_PATH = 'auth/callback';

export function getAuthRedirectUri(): string {
  const uri = Linking.createURL(AUTH_CALLBACK_PATH);

  if (__DEV__) {
    console.info(
      `[auth] OAuth redirect URI → ${uri}` +
        (Constants.appOwnership === 'expo'
          ? ' (add this exact URL in Supabase Dashboard → Auth → URL Configuration → Redirect URLs)'
          : '')
    );
  }

  return uri;
}

export type AuthCallbackParams = {
  access_token?: string;
  refresh_token?: string;
  code?: string;
  error?: string;
  error_description?: string;
};

/** Parses query and hash parameters from a Supabase auth redirect URL. */
export function parseAuthCallbackParams(url: string): AuthCallbackParams {
  const params: AuthCallbackParams = {};

  const merge = (search: string) => {
    const sp = new URLSearchParams(search);
    sp.forEach((value, key) => {
      if (key === 'access_token') params.access_token = value;
      else if (key === 'refresh_token') params.refresh_token = value;
      else if (key === 'code') params.code = value;
      else if (key === 'error') params.error = value;
      else if (key === 'error_description') params.error_description = value;
    });
  };

  try {
    const parsed = new URL(url);
    merge(parsed.search);
    if (parsed.hash) {
      merge(parsed.hash.replace(/^#/, ''));
    }
    return params;
  } catch {
    const queryIndex = url.indexOf('?');
    const hashIndex = url.indexOf('#');
    if (queryIndex >= 0) {
      const end = hashIndex >= 0 ? hashIndex : url.length;
      merge(url.slice(queryIndex + 1, end));
    }
    if (hashIndex >= 0) {
      merge(url.slice(hashIndex + 1));
    }
    return params;
  }
}

export function isAuthCallbackUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('auth/callback') ||
    lower.includes('access_token=') ||
    lower.includes('refresh_token=') ||
    (lower.includes('code=') &&
      (lower.startsWith('myfavoriteservices:') ||
        lower.startsWith('exp:') ||
        lower.includes('supabase.co')))
  );
}

/**
 * Finishes an auth redirect (Google OAuth, email confirm link, magic link).
 * Supports PKCE (`code`) and implicit/hash (`access_token`) callbacks.
 */
export async function completeAuthFromCallbackUrl(
  url: string
): Promise<{ error: { message: string } | null }> {
  if (url === authCallbackCompleted) {
    return { error: null };
  }
  if (url === authCallbackInFlight) {
    return { error: null };
  }

  authCallbackInFlight = url;

  const params = parseAuthCallbackParams(url);

  try {
    if (params.error) {
      return authCallbackError(params.error_description || params.error);
    }

    if (params.code) {
      const { error } = await supabase.auth.exchangeCodeForSession(params.code);
      if (error) return { error };
      authCallbackCompleted = url;
      return { error: null };
    }

    if (params.access_token) {
      const { error } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token ?? '',
      });
      if (error) return { error };
      authCallbackCompleted = url;
      return { error: null };
    }

    return authCallbackError(
      'Sign-in link is missing credentials. Try again or request a new code.'
    );
  } finally {
    authCallbackInFlight = null;
  }
}
