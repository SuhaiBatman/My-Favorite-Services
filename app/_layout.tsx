import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { FavoritesProvider } from '../contexts/FavoritesContext';
import { NotificationsProvider } from '../contexts/NotificationsContext';
import { OnboardingCelebrationProvider, useOnboardingCelebration } from '../contexts/OnboardingCelebrationContext';
import { BrandLogo } from '../components/BrandLogo';
import { OnboardingCompleteOverlay } from '../components/OnboardingCompleteOverlay';
import { ThemeProvider, useAppTheme } from '../contexts/ThemeContext';
import { DEV_USER_IDS } from '../constants/dev';
import { configureGoogleSignIn } from '../lib/googleSignIn';
import { useAuthDeepLinkListener } from '../hooks/use-auth-deep-link';
import { useProfileDeepLinkListener } from '../hooks/use-profile-link';

SplashScreen.preventAutoHideAsync();

type AuthRouteDecision =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'redirect'; href: '/(auth)/login' | '/(auth)/onboarding' | '/(tabs)' };

function resolveAuthRoute(
  session: ReturnType<typeof useAuth>['session'],
  role: ReturnType<typeof useAuth>['role'],
  roles: ReturnType<typeof useAuth>['roles'],
  segments: string[],
  isLoading: boolean,
  isOnboardingCelebrating: boolean
): AuthRouteDecision {
  if (isLoading) return { status: 'loading' };

  const inAuthGroup = segments[0] === '(auth)';
  const isPublicProfile = segments[0] === 'profile' || segments[0] === 'p';
  const isAuthCallback = segments[0] === 'auth' && segments[1] === 'callback';

  if (!session) {
    if (!inAuthGroup && !isPublicProfile && !isAuthCallback) {
      return { status: 'redirect', href: '/(auth)/login' };
    }
    return { status: 'ready' };
  }

  if (!role && roles.length === 0) {
    if (segments[1] !== 'onboarding') {
      return { status: 'redirect', href: '/(auth)/onboarding' };
    }
    return { status: 'ready' };
  }

  const isDevUser = session.user && DEV_USER_IDS.includes(session.user.id);
  const isOnboarding = segments[1] === 'onboarding';

  if (inAuthGroup && (!isDevUser || !isOnboarding)) {
    if (isOnboardingCelebrating) {
      return { status: 'ready' };
    }
    return { status: 'redirect', href: '/(tabs)' };
  }

  return { status: 'ready' };
}

function needsOnboarding(
  session: ReturnType<typeof useAuth>['session'],
  role: ReturnType<typeof useAuth>['role'],
  roles: ReturnType<typeof useAuth>['roles']
) {
  return Boolean(session && !role && roles.length === 0);
}

function InitialLayout({ fontsReady }: { fontsReady: boolean }) {
  const { session, isLoading, role, roles } = useAuth();
  const {
    isCelebrating: isOnboardingCelebrating,
    celebration,
    hideCelebration,
  } = useOnboardingCelebration();
  const { theme, isDark } = useAppTheme();
  const segments = useSegments();
  const router = useRouter();

  useAuthDeepLinkListener();
  useProfileDeepLinkListener();

  const routeDecision = useMemo(
    () => resolveAuthRoute(session, role, roles, segments, isLoading, isOnboardingCelebrating),
    [session, role, roles, segments, isLoading, isOnboardingCelebrating]
  );

  const onboardingRequired = needsOnboarding(session, role, roles);
  const onOnboardingScreen =
    segments[0] === '(auth)' && segments[1] === 'onboarding';
  const onTabsWhileOnboarding = onboardingRequired && segments[0] === '(tabs)';
  const atEntryIndex = segments.length === 0;
  const isRouteReady =
    Boolean(celebration) ||
    (routeDecision.status === 'ready' &&
      !atEntryIndex &&
      !onTabsWhileOnboarding &&
      (!onboardingRequired || onOnboardingScreen));

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  useEffect(() => {
    if (routeDecision.status === 'redirect') {
      router.replace(routeDecision.href);
    }
  }, [routeDecision, router]);

  useEffect(() => {
    if (fontsReady && isRouteReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsReady, isRouteReady]);

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
    <View style={styles.root}>
      <NavThemeProvider value={navigationTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="auth/callback" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="account" options={{ headerShown: false }} />
          <Stack.Screen name="profile/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="p/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </NavThemeProvider>
      {!isRouteReady && (
        <View
          pointerEvents="auto"
          style={[
            StyleSheet.absoluteFillObject,
            styles.splashOverlay,
            { backgroundColor: isDark ? SPLASH_BACKGROUND_DARK : SPLASH_BACKGROUND_LIGHT },
          ]}
        >
          <BrandLogo size={280} />
        </View>
      )}
      {celebration ? (
        <View style={styles.celebrationLayer} pointerEvents="box-none">
          <OnboardingCompleteOverlay
            visible
            firstName={celebration.firstName}
            role={celebration.role}
            onFinished={hideCelebration}
          />
        </View>
      ) : null}
    </View>
  );
}

const SPLASH_BACKGROUND_LIGHT = '#FFFFFF';
const SPLASH_BACKGROUND_DARK = '#0B1120';

const styles = StyleSheet.create({
  root: { flex: 1 },
  splashOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    elevation: 50,
  },
  celebrationLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const fontsReady = loaded || Boolean(error);

  if (!fontsReady) {
    return null;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <FavoritesProvider>
          <NotificationsProvider>
            <OnboardingCelebrationProvider>
              <InitialLayout fontsReady={fontsReady} />
            </OnboardingCelebrationProvider>
          </NotificationsProvider>
        </FavoritesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
