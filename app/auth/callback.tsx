import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useURL } from 'expo-linking';
import {
  completeAuthFromCallbackUrl,
  type AuthCallbackParams,
} from '../../lib/authCallback';

function buildCallbackUrl(
  baseUrl: string | null,
  params: Record<string, string | string[] | undefined>
): string | null {
  if (baseUrl) return baseUrl;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.length > 0) {
      query.set(key, value);
    }
  }
  if (query.size === 0) return null;

  return `myfavoriteservices://auth/callback?${query.toString()}`;
}

/** OAuth / email-confirm landing route (matches deep link `.../auth/callback`). */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const url = useURL();
  const params = useLocalSearchParams<AuthCallbackParams>();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;

    const callbackUrl = buildCallbackUrl(url, params);
    if (!callbackUrl) return;

    handled.current = true;

    void (async () => {
      const { error } = await completeAuthFromCallbackUrl(callbackUrl);
      if (error) {
        Alert.alert('Sign-in failed', error.message);
        router.replace('/(auth)/login');
        return;
      }
      router.replace('/(tabs)');
    })();
  }, [url, params, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#111827" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
