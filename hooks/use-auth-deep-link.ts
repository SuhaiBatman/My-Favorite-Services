import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { Alert } from 'react-native';
import {
  completeAuthFromCallbackUrl,
  isAuthCallbackUrl,
} from '../lib/authCallback';

/** Handles email-confirm and other auth deep links opened outside the in-app browser. */
export function useAuthDeepLinkListener() {
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (!isAuthCallbackUrl(url)) return;

      const { error } = await completeAuthFromCallbackUrl(url);
      if (error) {
        Alert.alert('Sign-in failed', error.message);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) void handleUrl(url);
    });

    const sub = Linking.addEventListener('url', ({ url }) => {
      void handleUrl(url);
    });

    return () => sub.remove();
  }, []);
}
