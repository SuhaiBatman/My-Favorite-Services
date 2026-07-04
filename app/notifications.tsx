import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Swipeable } from 'react-native-gesture-handler';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import { Card } from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationsContext';
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
  type AppNotification,
} from '../lib/notifications';
import { formatRelativeTime } from '../lib/format';

function notificationIcon(type: AppNotification['type']): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'new_appointment':
    case 'appointment_confirmed':
    case 'appointment_declined':
    case 'appointment_rescheduled':
    case 'reschedule_requested':
    case 'reschedule_accepted':
    case 'reschedule_declined':
      return 'calendar-outline';
    case 'new_client':
      return 'person-add-outline';
    default:
      return 'notifications-outline';
  }
}

export default function NotificationsScreen() {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { user } = useAuth();
  const { markOneRead, markAllRead, refresh: refreshUnreadCount } = useNotifications();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      setNotifications(await listNotifications(user.id));
      await refreshUnreadCount();
    } catch (e) {
      console.error('NotificationsScreen load:', e);
    }
  }, [refreshUnreadCount, user?.id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        await load();
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [load])
  );

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      return subscribeToNotifications(user.id, load);
    }, [user?.id, load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const openNotification = async (notification: AppNotification) => {
    if (!notification.read_at) {
      try {
        await markNotificationRead(notification.id);
        markOneRead();
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? { ...item, read_at: new Date().toISOString() }
              : item
          )
        );
      } catch (e) {
        console.error('markNotificationRead:', e);
      }
    }

    const appointmentId = notification.data?.appointment_id;
    if (typeof appointmentId === 'string') {
      router.push('/schedule');
      return;
    }

    const profileId =
      notification.data?.client_id ?? notification.data?.provider_id;
    if (typeof profileId === 'string') {
      router.push({ pathname: '/profile/[id]', params: { id: profileId, returnTo: '/notifications' } });
    }
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    try {
      await markAllNotificationsRead(user.id);
      markAllRead();
      await load();
    } catch (e) {
      console.error('markAllNotificationsRead:', e);
    }
  };

  const handleDelete = async (notification: AppNotification) => {
    swipeableRefs.current.get(notification.id)?.close();

    try {
      await deleteNotification(notification.id);
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
    } catch (e) {
      console.error('deleteNotification:', e);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const renderDeleteAction = (
    progress: Animated.AnimatedInterpolation<number>,
    notification: AppNotification
  ) => {
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [72, 0],
    });

    return (
      <Animated.View style={[styles.deleteActionWrap, { transform: [{ translateX }] }]}>
        <TouchableOpacity
          style={styles.deleteAction}
          onPress={() => void handleDelete(notification)}
          accessibilityLabel="Delete notification"
        >
          <Ionicons name="trash-outline" size={20} color={theme.colors.textInverted} />
          <Text style={styles.deleteActionText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderNotification = ({ item: notification }: { item: AppNotification }) => {
    const unread = !notification.read_at;
    const card = (
      <Pressable onPress={() => void openNotification(notification)}>
        <Card
          style={
            unread
              ? [styles.notificationCard, styles.notificationCardUnread]
              : styles.notificationCard
          }
          variant="outlined"
        >
          <View style={[styles.iconWrap, unread && styles.iconWrapUnread]}>
            <Ionicons
              name={notificationIcon(notification.type)}
              size={20}
              color={unread ? theme.colors.secondary : theme.colors.textSecondary}
            />
          </View>
          <View style={styles.notificationContent}>
            <View style={styles.notificationHeader}>
              <Text
                style={[styles.notificationTitle, unread && styles.notificationTitleUnread]}
                numberOfLines={1}
              >
                {notification.title}
              </Text>
              <Text style={styles.notificationTime}>
                {formatRelativeTime(notification.created_at)}
              </Text>
            </View>
            <Text style={styles.notificationBody} numberOfLines={3}>
              {notification.body}
            </Text>
          </View>
          {unread ? <View style={styles.unreadDot} /> : null}
        </Card>
      </Pressable>
    );

    if (unread) {
      return <View style={styles.row}>{card}</View>;
    }

    return (
      <Swipeable
        ref={(ref) => {
          if (ref) swipeableRefs.current.set(notification.id, ref);
          else swipeableRefs.current.delete(notification.id);
        }}
        friction={2}
        overshootRight={false}
        onSwipeableWillOpen={() => {
          swipeableRefs.current.forEach((ref, id) => {
            if (id !== notification.id) ref.close();
          });
        }}
        renderRightActions={(progress) => renderDeleteAction(progress, notification)}
      >
        <View style={styles.row}>{card}</View>
      </Swipeable>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 ? (
              <Text style={styles.headerSubtitle}>{unreadCount} unread</Text>
            ) : null}
          </View>
          {unreadCount > 0 ? (
            <TouchableOpacity onPress={() => void handleMarkAllRead()} hitSlop={8}>
              <Text style={styles.markAllRead}>Mark all read</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>
      </SafeAreaView>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.secondary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Card style={styles.emptyCard} variant="outlined">
              <Ionicons name="notifications-outline" size={48} color={theme.colors.border} />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySubtitle}>
                New appointments, clients, and schedule updates will appear here.
              </Text>
            </Card>
          }
        />
      )}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    headerSafeArea: {
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: { flex: 1 },
    headerSpacer: { width: 72 },
    headerTitle: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.sizes.h1,
      color: theme.colors.textPrimary,
    },
    headerSubtitle: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    markAllRead: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.secondary,
    },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl, flexGrow: 1 },
    emptyCard: {
      alignItems: 'center',
      padding: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    emptyTitle: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
    },
    emptySubtitle: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    row: {
      marginBottom: theme.spacing.sm,
    },
    notificationCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.md,
      padding: theme.spacing.md,
    },
    notificationCardUnread: {
      backgroundColor: theme.colors.primaryLight,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapUnread: {
      backgroundColor: theme.colors.surface,
    },
    notificationContent: { flex: 1 },
    notificationHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
      marginBottom: 4,
    },
    notificationTitle: {
      flex: 1,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
    },
    notificationTitleUnread: {
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    notificationTime: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
    },
    notificationBody: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.secondary,
      marginTop: 6,
    },
    deleteActionWrap: {
      width: 88,
      marginBottom: theme.spacing.sm,
    },
    deleteAction: {
      flex: 1,
      backgroundColor: theme.colors.destructive,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginLeft: theme.spacing.sm,
    },
    deleteActionText: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textInverted,
    },
  });
}
