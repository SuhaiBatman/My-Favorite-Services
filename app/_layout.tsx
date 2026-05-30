import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import * as SystemUI from 'expo-system-ui';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider, useAppTheme } from '../contexts/ThemeContext';
import { DEV_USER_IDS } from '../constants/dev';
import { configureGoogleSignIn } from '../lib/googleSignIn';
import { useAuthDeepLinkListener } from '../hooks/use-auth-deep-link';
import { useProfileDeepLinkListener } from '../hooks/use-profile-link';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

function InitialLayout() {
  const { session, isLoading, role, roles } = useAuth();
  const { theme, isDark } = useAppTheme();
  const segments = useSegments();
  const router = useRouter();

  useAuthDeepLinkListener();
  useProfileDeepLinkListener();

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isPublicProfile = segments[0] === 'profile' || segments[0] === 'p';
    const isAuthCallback = segments[0] === 'auth' && segments[1] === 'callback';

    if (!session) {
      if (!inAuthGroup && !isPublicProfile && !isAuthCallback) {
        router.replace('/(auth)/login');
      }
    } else {
      // User is signed in
      if (!role && roles.length === 0) {
        if (segments[1] !== 'onboarding') {
          router.replace('/(auth)/onboarding');
        }
      } else {
        // User is signed in and has a role
        // Dev bypass: Allow dev users to visit onboarding even if they have a role
        const isDevUser = session.user && DEV_USER_IDS.includes(session.user.id);
        const isOnboarding = segments[1] === 'onboarding';

        if (inAuthGroup && (!isDevUser || !isOnboarding)) {
          router.replace('/(tabs)');
        }
      }
    }
  }, [session, isLoading, role, roles, segments]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => {});
  }, [theme.colors.background]);

  const navigationTheme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        primary: theme.colors.secondary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.textPrimary,
        border: theme.colors.border,
        notification: theme.colors.secondary,
      },
    }),
    [isDark, theme]
  );

  return (
    <NavThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="account" options={{ headerShown: false }} />
        <Stack.Screen name="profile/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="p/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <InitialLayout />
      </AuthProvider>
    </ThemeProvider>
  );
}
