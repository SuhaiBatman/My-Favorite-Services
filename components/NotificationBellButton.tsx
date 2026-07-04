import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationsContext';
import { useThemedStyles } from '../hooks/use-themed-styles';

type NotificationBellButtonProps = {
  style?: ViewStyle;
};

export function NotificationBellButton({ style }: NotificationBellButtonProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { unreadCount } = useNotifications();

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <TouchableOpacity
      style={[styles.btn, style]}
      onPress={() => router.push('/notifications' as never)}
      accessibilityLabel={
        unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
      }
    >
      <Ionicons name="notifications-outline" size={22} color={theme.colors.textPrimary} />
      {unreadCount > 0 ? (
        <ViewBadge styles={styles} label={badgeLabel} />
      ) : null}
    </TouchableOpacity>
  );
}

function ViewBadge({
  styles,
  label,
}: {
  styles: ReturnType<typeof createStyles>;
  label: string;
}) {
  return (
    <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    btn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      position: 'absolute',
      top: 4,
      right: 4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      borderWidth: 2,
      borderColor: theme.colors.surface,
    },
    badgeText: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      color: theme.colors.textInverted,
      lineHeight: 12,
    },
  });
}
