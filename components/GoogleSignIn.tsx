import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import {
  configureGoogleSignIn,
  isNativeGoogleSignInAvailable,
  signInWithGoogleNative,
} from '../lib/googleSignIn';

type Props = {
  disabled?: boolean;
};

export function GoogleSignIn({ disabled = false }: Props) {
  const [loading, setLoading] = useState(false);
  const nativeAvailable = isNativeGoogleSignInAvailable();

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  async function handlePress() {
    if (loading || disabled) return;

    setLoading(true);
    try {
      const { error } = await signInWithGoogleNative();
      if (error) Alert.alert('Google Sign-In failed', error.message);
    } finally {
      setLoading(false);
    }
  }

  if (!nativeAvailable) {
    return (
      <View style={styles.expoGoNotice}>
        <Text style={styles.expoGoTitle}>Google Sign-In unavailable in Expo Go</Text>
        <Text style={styles.expoGoBody}>
          Run a native dev build: npm run android:dev
        </Text>
      </View>
    );
  }

  return (
    <GoogleSigninButton
      size={GoogleSigninButton.Size.Wide}
      color={GoogleSigninButton.Color.Light}
      onPress={handlePress}
      disabled={disabled || loading}
      style={styles.button}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 52,
  },
  expoGoNotice: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
  },
  expoGoTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#92400E',
    marginBottom: 4,
  },
  expoGoBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#B45309',
  },
});
