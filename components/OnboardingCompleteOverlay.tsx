import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import { playCelebrationHaptics } from '../lib/celebrationFeedback';
import { Button } from './Button';

type Role = 'user' | 'employee' | 'business';

type OnboardingCompleteOverlayProps = {
  visible: boolean;
  firstName: string;
  role: Role;
  onFinished: () => void;
};

const ROLE_COPY: Record<
  Role,
  { headline: string; subline: string; badge: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  user: {
    headline: 'Ready to explore',
    subline: 'Discover providers and save your favorites.',
    badge: 'Favorite Finder',
    icon: 'heart',
  },
  employee: {
    headline: 'Profile complete',
    subline: 'Share your QR code and start connecting.',
    badge: 'Service Provider',
    icon: 'briefcase',
  },
  business: {
    headline: 'Business is live',
    subline: 'Manage your team and grow your presence.',
    badge: 'Business Owner',
    icon: 'storefront',
  },
};

export function OnboardingCompleteOverlay({
  visible,
  firstName,
  role,
  onFinished,
}: OnboardingCompleteOverlayProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const popAnim = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const copy = ROLE_COPY[role];
  const greeting = firstName.trim() ? `You're all set, ${firstName.trim()}!` : "You're all set!";

  useEffect(() => {
    if (!visible) {
      popAnim.setValue(0);
      ringAnim.setValue(0);
      return;
    }

    void playCelebrationHaptics();

    Animated.parallel([
      Animated.spring(popAnim, {
        toValue: 1,
        speed: 18,
        bounciness: 14,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(80),
        Animated.spring(ringAnim, {
          toValue: 1,
          speed: 14,
          bounciness: 6,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [visible, popAnim, ringAnim]);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

        <Animated.View
          style={[
            styles.card,
            {
              opacity: popAnim,
              transform: [
                {
                  scale: popAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.75, 1],
                  }),
                },
                {
                  translateY: popAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.iconRing,
              {
                transform: [
                  {
                    scale: ringAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="checkmark" size={44} color={theme.colors.textInverted} />
            </View>
          </Animated.View>

          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.headline}>{copy.headline}</Text>
          <Text style={styles.subline}>{copy.subline}</Text>

          <View style={styles.roleBadge}>
            <Ionicons name={copy.icon} size={16} color={theme.colors.secondary} />
            <Text style={styles.roleBadgeText}>{copy.badge}</Text>
          </View>

          <Button
            title="Continue to Home"
            onPress={onFinished}
            style={styles.continueBtn}
            icon={
              <Ionicons name="home-outline" size={20} color={theme.colors.textInverted} />
            }
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      backgroundColor: 'rgba(15, 23, 42, 0.35)',
    },
    card: {
      width: '100%',
      maxWidth: 340,
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 28,
      paddingHorizontal: 28,
      paddingTop: 36,
      paddingBottom: 32,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 16,
    },
    iconRing: {
      marginBottom: 24,
    },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: theme.colors.success,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.colors.success,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 14,
      elevation: 10,
    },
    greeting: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 22,
      color: theme.colors.textPrimary,
      textAlign: 'center',
      marginBottom: 8,
    },
    headline: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: 17,
      color: theme.colors.secondary,
      textAlign: 'center',
      marginBottom: 6,
    },
    subline: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: 15,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 20,
    },
    roleBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primaryLight,
    },
    roleBadgeText: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 13,
      color: theme.colors.secondary,
    },
    continueBtn: {
      width: '100%',
      marginTop: 24,
    },
  });
}
