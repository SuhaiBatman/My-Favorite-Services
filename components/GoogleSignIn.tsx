import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import {
  configureGoogleSignIn,
  isNativeGoogleSignInAvailable,
  signInWithGoogleNative,
} from '../lib/googleSignIn';

type Props = {
  disabled?: boolean;
};

export function GoogleSignIn({ disabled = false }: Props) {
  const { isDark } = useAppTheme();
  const styles = useThemedStyles(createStyles);
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
      color={isDark ? GoogleSigninButton.Color.Dark : GoogleSigninButton.Color.Light}
      onPress={handlePress}
      disabled={disabled || loading}
      style={styles.button}
    />
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    button: {
      width: '100%',
      height: 52,
    },
    expoGoNotice: {
      width: '100%',
      padding: 14,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.primaryLight,
    },
    expoGoTitle: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.textPrimary,
      marginBottom: 4,
    },
    expoGoBody: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
  });
}
