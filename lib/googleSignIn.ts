import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {
  GOOGLE_WEB_CLIENT_ID,
} from '../constants/google';
import { supabase } from './supabase';

let configured = false;

/** Native Google Sign-In is unavailable in Expo Go (no native module). */
export function isNativeGoogleSignInAvailable(): boolean {
  return Constants.appOwnership !== 'expo';
}

function getGoogleWebClientId(): string {
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  if (fromEnv) return fromEnv;

  const extra = Constants.expoConfig?.extra as { googleWebClientId?: string } | undefined;
  const fromExtra = extra?.googleWebClientId?.trim();
  if (fromExtra) return fromExtra;

  return GOOGLE_WEB_CLIENT_ID;
}

function getGoogleIosClientId(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (fromEnv) return fromEnv;

  const extra = Constants.expoConfig?.extra as { googleIosClientId?: string } | undefined;
  return extra?.googleIosClientId?.trim() || undefined;
}

export function configureGoogleSignIn(): void {
  if (configured || !isNativeGoogleSignInAvailable()) return;

  const webClientId = getGoogleWebClientId();
  if (!webClientId) {
    if (__DEV__) {
      console.warn(
        '[google-sign-in] Missing Google Web Client ID.'
      );
    }
    return;
  }

  const iosClientId = getGoogleIosClientId();

  GoogleSignin.configure({
    webClientId,
    ...(Platform.OS === 'ios' && iosClientId ? { iosClientId } : {}),
    offlineAccess: false,
  });

  configured = true;

  if (__DEV__) {
    console.info(
      '[google-sign-in] Configured with Web client ID (Android OAuth client is linked via GCC package + SHA-1).'
    );
  }
}

export function isGoogleSignInConfigured(): boolean {
  return !!getGoogleWebClientId();
}

export async function signInWithGoogleNative(): Promise<{
  error: { message: string } | null;
}> {
  if (!isNativeGoogleSignInAvailable()) {
    return {
      error: {
        message:
          'Google Sign-In needs a native build (not Expo Go). Run: npm run android:dev',
      },
    };
  }

  configureGoogleSignIn();

  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      return { error: null };
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      return { error: { message: 'Google did not return an ID token.' } };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    return error ? { error } : { error: null };
  } catch (e: unknown) {
    if (isErrorWithCode(e)) {
      if (
        e.code === statusCodes.SIGN_IN_CANCELLED ||
        e.code === statusCodes.IN_PROGRESS
      ) {
        return { error: null };
      }
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return {
          error: {
            message: 'Google Play Services is unavailable or outdated on this device.',
          },
        };
      }
    }

    const message = e instanceof Error ? e.message : 'Google Sign-In failed.';
    if (message.includes('DEVELOPER_ERROR')) {
      return {
        error: {
          message:
            'Google DEVELOPER_ERROR: add the app SHA-1 from `npm run android:sha1` to your Android OAuth client in Google Cloud Console (package: com.suhaibatman.myfavoriteservices). Supabase client IDs do not fix this.',
        },
      };
    }
    return { error: { message } };
  }
}
