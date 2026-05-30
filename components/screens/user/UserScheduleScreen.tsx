import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import type { AppTheme } from '../../../constants/theme';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { useThemedStyles } from '../../../hooks/use-themed-styles';
import { Card } from '../../Card';
import { ProviderAvatar } from '../../ProviderAvatar';
import { AppointmentDetailSheet } from '../../AppointmentDetailSheet';
import { UserBookAppointmentModal } from '../../UserBookAppointmentModal';
import { useAuth } from '../../../contexts/AuthContext';
import { listUserUpcomingAppointments, type Appointment } from '../../../lib/appointments';
import { getOrCreateConversation } from '../../../lib/messaging';
import {
  formatAppointmentDate,
  formatAppointmentTime,
  formatDurationMinutes,
  profileDisplayName,
} from '../../../lib/format';
interface UserScheduleScreenProps {
  externalModalVisible?: boolean;
  onExternalModalClose?: () => void;
}

export default function UserScheduleScreen({
  externalModalVisible,
  onExternalModalClose,
}: UserScheduleScreenProps = {}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const { user } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [bookModalVisible, setBookModalVisible] = useState(false);
  useEffect(() => {
    if (externalModalVisible) {
      setBookModalVisible(true);
      onExternalModalClose?.();
    }
  }, [externalModalVisible, onExternalModalClose]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const appts = await listUserUpcomingAppointments(user.id);
      setAppointments(appts);
    } catch (e) {
      console.error('UserScheduleScreen load:', e);
    }
  }, [user?.id]);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openProvider = (providerId: string) => {
    router.push(`/profile/${providerId}`);
  };

  const messageProvider = async (providerId: string) => {
    setSelectedAppointment(null);
    try {
      const conversationId = await getOrCreateConversation(providerId);
      router.push(`/chat/${conversationId}`);
    } catch {
      openProvider(providerId);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Schedule</Text>
          <Text style={styles.headerSubtitle}>{appointments.length} upcoming</Text>
        </View>
      </SafeAreaView>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.secondary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {appointments.length === 0 ? (
            <Card style={styles.emptyCard} variant="outlined">
              <Ionicons name="calendar-outline" size={48} color={theme.colors.border} />
              <Text style={styles.emptyTitle}>Nothing scheduled</Text>
              <Text style={styles.emptySubtitle}>
                Your upcoming appointments will show here with duration, location, and notes.
              </Text>
            </Card>
          ) : (
            appointments.map((meeting) => {
              const providerName = profileDisplayName(
                meeting.provider?.first_name,
                meeting.provider?.last_name
              );
              const role =
                meeting.provider?.job_title ||
                meeting.provider?.business_name ||
                'Service Provider';
              const statusConfirmed = meeting.status === 'confirmed';

              return (
                <Pressable key={meeting.id} onPress={() => setSelectedAppointment(meeting)}>
                  <Card style={styles.meetingCard}>
                    <View style={styles.meetingTop}>
                      <View style={styles.dateRow}>
                        <Ionicons name="calendar-outline" size={16} color={theme.colors.secondary} />
                        <Text style={styles.meetingDate}>
                          {formatAppointmentDate(meeting.starts_at)} · {formatAppointmentTime(meeting.starts_at)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.badge,
                          statusConfirmed ? styles.badgeConfirmed : styles.badgePending,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            statusConfirmed ? styles.badgeTextConfirmed : styles.badgeTextPending,
                          ]}
                        >
                          {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.durationRow}>
                      <Ionicons name="time-outline" size={14} color={theme.colors.textSecondary} />
                      <Text style={styles.durationText}>
                        {formatDurationMinutes(meeting.starts_at, meeting.ends_at)}
                      </Text>
                      {meeting.location ? (
                        <>
                          <Text style={styles.dot}>·</Text>
                          <Ionicons name="location-outline" size={14} color={theme.colors.textSecondary} />
                          <Text style={styles.locationPreview} numberOfLines={1}>
                            {meeting.location}
                          </Text>
                        </>
                      ) : null}
                    </View>

                    <View style={styles.cardDivider} />

                    <View style={styles.meetingInfo}>
                      <ProviderAvatar name={providerName} size={48} />
                      <View style={styles.meetingDetails}>
                        <Text style={styles.meetingProvider}>{providerName}</Text>
                        <Text style={styles.meetingRole}>{role}</Text>
                        <Text style={styles.meetingService}>{meeting.service_name}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
                    </View>
                  </Card>
                </Pressable>
              );
            })
          )}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      <AppointmentDetailSheet
        appointment={selectedAppointment}
        visible={!!selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        onViewProvider={openProvider}
        onMessageProvider={messageProvider}
      />

      <UserBookAppointmentModal
        visible={bookModalVisible}
        onClose={() => setBookModalVisible(false)}
        onBooked={load}
      />
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerSafeArea: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  header: {
    paddingTop: theme.spacing.md,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes.h1,
    color: theme.colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: theme.spacing.md,
  },
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
  meetingCard: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  meetingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  meetingDate: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  badgeConfirmed: {
    backgroundColor: theme.colors.primaryLight,
  },
  badgePending: {
    backgroundColor: theme.colors.primaryLight,
  },
  badgeText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: 10,
  },
  badgeTextConfirmed: {
    color: theme.colors.success,
  },
  badgeTextPending: {
    color: theme.colors.secondary,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  durationText: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
  },
  dot: {
    color: theme.colors.textSecondary,
  },
  locationPreview: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
    flex: 1,
    maxWidth: 140,
  },
  cardDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
    opacity: 0.6,
  },
  meetingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  meetingDetails: {
    flex: 1,
  },
  meetingProvider: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  meetingRole: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  meetingService: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.secondary,
  },
  bottomSpacer: {
    height: 110,
  },
  });
}