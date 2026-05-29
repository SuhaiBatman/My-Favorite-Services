import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { AppTheme } from '../../constants/theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../hooks/use-themed-styles';
import { APP_DOWNLOAD_URL } from '../../constants/links';
import { buildProfileDeepLink } from '../../lib/qr';

/**
 * Web/smart-link landing for QR codes opened in a browser when the app is not installed.
 * Tries the custom scheme first, then redirects to APP_DOWNLOAD_URL when set.
 */
export default function ProfileSmartLinkScreen() {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const { id } = useLocalSearchParams<{ id: string }>();
  const profileId = typeof id === 'string' ? id : id?.[0];
  const [status, setStatus] = useState<'opening' | 'download' | 'waiting'>('opening');

  useEffect(() => {
    if (!profileId) return;

    const deepLink = buildProfileDeepLink(profileId);

    const tryOpenApp = async () => {
      if (Platform.OS !== 'web') {
        const canOpen = await Linking.canOpenURL(deepLink);
        if (canOpen) {
          await Linking.openURL(deepLink);
        }
        return;
      }

      window.location.href = deepLink;

      const timer = setTimeout(() => {
        if (APP_DOWNLOAD_URL) {
          setStatus('download');
          window.location.href = APP_DOWNLOAD_URL;
        } else {
          setStatus('waiting');
        }
      }, 2000);

      return () => clearTimeout(timer);
    };

    tryOpenApp();
  }, [profileId]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.secondary} />
      <Text style={styles.title}>
        {status === 'waiting'
          ? 'Open in My Favorite Services'
          : 'Opening My Favorite Services…'}
      </Text>
      <Text style={styles.subtitle}>
        {status === 'waiting'
          ? 'Install the app to view this provider and save them to your favorites.'
          : 'If nothing happens, install the app to continue.'}
      </Text>
      {status === 'waiting' && !APP_DOWNLOAD_URL ? (
        <Text style={styles.hint}>App download link coming soon.</Text>
      ) : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: theme.colors.background,
    gap: 12,
  },
  title: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.title,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  hint: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
  });
}