import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import type { AppTheme } from '../../../constants/theme';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { useThemedStyles } from '../../../hooks/use-themed-styles';
import { Card } from '../../Card';
import { Button } from '../../Button';
import { ProviderAvatar } from '../../ProviderAvatar';
import { ScheduleCalendar } from '../../ScheduleCalendar';
import { AppointmentDetailSheet } from '../../AppointmentDetailSheet';
import { UserBookAppointmentModal } from '../../UserBookAppointmentModal';
import { RescheduleAppointmentModal } from '../../RescheduleAppointmentModal';
import { useAuth } from '../../../contexts/AuthContext';
import {
  listAppointmentsInRange,
  respondToAppointmentAsProvider,
  respondToReschedule,
  cancelAppointmentAsProvider,
  subscribeToAppointmentUpdates,
  hasPendingReschedule,
  isRescheduleAwaitingResponse,
  type Appointment,
} from '../../../lib/appointments';
import {
  appointmentsOnLocalDay,
  buildScheduleMarkers,
} from '../../../lib/appointmentCalendar';
import { getOrCreateConversation, getOrCreateConversationAsProvider } from '../../../lib/messaging';
import {
  formatAppointmentDate,
  formatAppointmentTime,
  monthLocalRange,
  profileDisplayName,
} from '../../../lib/format';

function formatLocalCalendarDay(date: Date): string {
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  return formatAppointmentDate(noon.toISOString());
}

interface EmployeeScheduleScreenProps {
  externalModalVisible?: boolean;
  onExternalModalClose?: () => void;
}

type SchedulePerspective = 'provider' | 'client';

function perspectiveForAppointment(
  appt: Appointment,
  employeeId: string
): SchedulePerspective {
  return appt.provider_id === employeeId ? 'provider' : 'client';
}

export default function EmployeeScheduleScreen({
  externalModalVisible,
  onExternalModalClose,
}: EmployeeScheduleScreenProps = {}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const { user } = useAuth();
  const router = useRouter();
  const [asProvider, setAsProvider] = useState<Appointment[]>([]);
  const [asClient, setAsClient] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [bookModalVisible, setBookModalVisible] = useState(false);
  const [responding, setResponding] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);

  React.useEffect(() => {
    if (externalModalVisible) {
      setBookModalVisible(true);
      onExternalModalClose?.();
    }
  }, [externalModalVisible, onExternalModalClose]);

  const loadMonth = useCallback(async () => {
    if (!user?.id) return;
    const { start, end } = monthLocalRange(viewMonth.year, viewMonth.month);
    try {
      const { asProvider: providerRows, asClient: clientRows } = await listAppointmentsInRange(
        user.id,
        start,
        end
      );
      setAsProvider(providerRows);
      setAsClient(clientRows);
    } catch (e) {
      console.error('EmployeeScheduleScreen load:', e);
    }
  }, [user?.id, viewMonth.year, viewMonth.month]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        await loadMonth();
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [loadMonth])
  );

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      return subscribeToAppointmentUpdates(user.id, loadMonth);
    }, [user?.id, loadMonth])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMonth();
    setRefreshing(false);
  };

  const allAppointments = useMemo(
    () => [...asProvider, ...asClient],
    [asProvider, asClient]
  );

  const { markers, pendingDays } = useMemo(() => {
    if (!user?.id) return { markers: {}, pendingDays: new Set<string>() };
    return buildScheduleMarkers(asProvider, asClient, user.id);
  }, [asProvider, asClient, user?.id]);

  const dayAppointments = useMemo(() => {
    if (!selectedDate) return [];
    return appointmentsOnLocalDay(allAppointments, selectedDate).sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );
  }, [allAppointments, selectedDate]);

  const handleRespond = async (appointmentId: string, decision: 'confirmed' | 'cancelled') => {
    setResponding(true);
    try {
      await respondToAppointmentAsProvider(appointmentId, decision);
      setSelectedAppointment(null);
      await loadMonth();
    } catch {
      Alert.alert('Error', 'Could not update the appointment. Please try again.');
    } finally {
      setResponding(false);
    }
  };

  const handleRescheduleRespond = async (
    appointmentId: string,
    decision: 'confirmed' | 'cancelled'
  ) => {
    setResponding(true);
    try {
      await respondToReschedule(appointmentId, decision);
      setSelectedAppointment(null);
      await loadMonth();
    } catch {
      Alert.alert('Error', 'Could not update the reschedule request. Please try again.');
    } finally {
      setResponding(false);
    }
  };

  const handleCancelAsProvider = async (appointmentId: string) => {
    Alert.alert('Cancel appointment?', 'The client will be notified that this appointment was cancelled.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel appointment',
        style: 'destructive',
        onPress: () => {
          setResponding(true);
          void cancelAppointmentAsProvider(appointmentId)
            .then(() => {
              setSelectedAppointment(null);
              return loadMonth();
            })
            .catch(() => {
              Alert.alert('Error', 'Could not cancel the appointment. Please try again.');
            })
            .finally(() => setResponding(false));
        },
      },
    ]);
  };

  const openPeerProfile = (appt: Appointment) => {
    const employeeId = user?.id;
    if (!employeeId) return;
    setSelectedAppointment(null);
    const peerId =
      appt.provider_id === employeeId ? appt.user_id : appt.provider_id;
    router.push({ pathname: '/profile/[id]', params: { id: peerId, returnTo: '/schedule' } });
  };

  const messagePeer = async (appt: Appointment) => {
    const employeeId = user?.id;
    if (!employeeId) return;
    setSelectedAppointment(null);
    try {
      const conversationId =
        appt.provider_id === employeeId
          ? await getOrCreateConversationAsProvider(appt.user_id)
          : await getOrCreateConversation(appt.provider_id);
      router.push(`/chat/${conversationId}`);
    } catch {
      openPeerProfile(appt);
    }
  };

  const selectedPerspective =
    selectedAppointment && user?.id
      ? perspectiveForAppointment(selectedAppointment, user.id)
      : 'client';

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Schedule</Text>
          <Text style={styles.headerSubtitle}>Provider & client</Text>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <ScheduleCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            dayMarkers={markers}
            pendingDays={pendingDays}
            onMonthChange={(year, month) => setViewMonth({ year, month })}
          />

          <Text style={styles.dayListTitle}>
            {selectedDate ? formatLocalCalendarDay(selectedDate) : 'Select a day'}
          </Text>

          {dayAppointments.length === 0 ? (
            <Card style={styles.emptyCard} variant="outlined">
              <Text style={styles.emptyText}>No appointments on this day</Text>
            </Card>
          ) : (
            dayAppointments.map((meeting) => {
              const asProvider = user?.id && meeting.provider_id === user.id;
              const peerName = asProvider
                ? profileDisplayName(meeting.user?.first_name, meeting.user?.last_name, 'Client')
                : profileDisplayName(
                    meeting.provider?.first_name,
                    meeting.provider?.last_name,
                    'Provider'
                  );
              const needsResponse =
                user?.id &&
                ((asProvider && meeting.status === 'pending') ||
                  isRescheduleAwaitingResponse(meeting, user.id));
              const roleLabel = needsResponse
                ? 'Needs response'
                : asProvider
                  ? 'As provider'
                  : 'As client';
              const roleColor = needsResponse ? '#111827' : asProvider ? '#2563EB' : '#16A34A';
              const statusConfirmed = meeting.status === 'confirmed' && !hasPendingReschedule(meeting);
              const isPendingProvider = asProvider && meeting.status === 'pending';
              const isRescheduleResponse =
                user?.id && isRescheduleAwaitingResponse(meeting, user.id);

              return (
                <Card key={meeting.id} style={styles.meetingCard}>
                  <Pressable onPress={() => setSelectedAppointment(meeting)}>
                    <View style={styles.meetingTop}>
                      <View style={styles.dateRow}>
                        <Ionicons
                          name="calendar-outline"
                          size={16}
                          color={roleColor}
                        />
                        <Text style={[styles.meetingDate, needsResponse && styles.meetingDateNeedsResponse]}>
                          {formatAppointmentTime(meeting.starts_at)} · {roleLabel}
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
                    <View style={styles.meetingInfo}>
                      <ProviderAvatar name={peerName} size={44} />
                      <View style={styles.meetingDetails}>
                        <Text style={styles.meetingProvider}>{peerName}</Text>
                        <Text style={styles.meetingService}>{meeting.service_name}</Text>
                      </View>
                    </View>
                  </Pressable>
                  {isRescheduleResponse ? (
                    <View style={styles.pendingActions}>
                      <Button
                        title="Decline"
                        variant="outline"
                        onPress={() => void handleRescheduleRespond(meeting.id, 'cancelled')}
                        disabled={responding}
                        style={styles.pendingBtn}
                      />
                      <Button
                        title="Accept"
                        onPress={() => void handleRescheduleRespond(meeting.id, 'confirmed')}
                        disabled={responding}
                        style={styles.pendingBtn}
                      />
                    </View>
                  ) : isPendingProvider ? (
                    <View style={styles.pendingActions}>
                      <Button
                        title="Decline"
                        variant="outline"
                        onPress={() => void handleRespond(meeting.id, 'cancelled')}
                        disabled={responding}
                        style={styles.pendingBtn}
                      />
                      <Button
                        title="Accept"
                        onPress={() => void handleRespond(meeting.id, 'confirmed')}
                        disabled={responding}
                        style={styles.pendingBtn}
                      />
                    </View>
                  ) : null}
                </Card>
              );
            })
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      <AppointmentDetailSheet
        appointment={selectedAppointment}
        visible={selectedAppointment !== null}
        onClose={() => setSelectedAppointment(null)}
        perspective={selectedPerspective}
        onViewPeer={
          selectedAppointment ? () => openPeerProfile(selectedAppointment) : undefined
        }
        onMessagePeer={
          selectedAppointment ? () => messagePeer(selectedAppointment) : undefined
        }
        onAccept={
          selectedPerspective === 'provider' &&
          selectedAppointment?.status === 'pending' &&
          !hasPendingReschedule(selectedAppointment)
            ? () => void handleRespond(selectedAppointment!.id, 'confirmed')
            : undefined
        }
        onDecline={
          selectedPerspective === 'provider' &&
          selectedAppointment?.status === 'pending' &&
          !hasPendingReschedule(selectedAppointment)
            ? () => void handleRespond(selectedAppointment!.id, 'cancelled')
            : undefined
        }
        onAcceptReschedule={
          selectedAppointment &&
          user?.id &&
          isRescheduleAwaitingResponse(selectedAppointment, user.id)
            ? () => void handleRescheduleRespond(selectedAppointment.id, 'confirmed')
            : undefined
        }
        onDeclineReschedule={
          selectedAppointment &&
          user?.id &&
          isRescheduleAwaitingResponse(selectedAppointment, user.id)
            ? () => void handleRescheduleRespond(selectedAppointment.id, 'cancelled')
            : undefined
        }
        onReschedule={
          selectedAppointment &&
          selectedAppointment.status === 'confirmed' &&
          !hasPendingReschedule(selectedAppointment)
            ? () => {
                setRescheduleTarget(selectedAppointment);
                setSelectedAppointment(null);
              }
            : undefined
        }
        onCancel={
          selectedPerspective === 'provider' &&
          selectedAppointment &&
          (selectedAppointment.status === 'confirmed' || selectedAppointment.status === 'pending')
            ? () => handleCancelAsProvider(selectedAppointment.id)
            : undefined
        }
      />

      <RescheduleAppointmentModal
        appointment={rescheduleTarget}
        visible={rescheduleTarget !== null}
        requestedById={user?.id ?? null}
        onClose={() => setRescheduleTarget(null)}
        onRescheduled={() => void loadMonth()}
      />

      <UserBookAppointmentModal
        visible={bookModalVisible}
        onClose={() => setBookModalVisible(false)}
        onBooked={() => void loadMonth()}
      />
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    headerSafeArea: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    header: { paddingTop: theme.spacing.md },
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
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: theme.spacing.md },
    dayListTitle: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.title,
      color: theme.colors.textPrimary,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    emptyCard: { padding: theme.spacing.lg, alignItems: 'center', marginBottom: theme.spacing.md },
    emptyText: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.textSecondary,
    },
    meetingCard: { marginBottom: theme.spacing.md, padding: theme.spacing.md },
    meetingTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    meetingDate: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.textPrimary,
    },
    meetingDateNeedsResponse: {
      fontFamily: theme.typography.fontFamily.semiBold,
      color: theme.colors.textPrimary,
    },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.borderRadius.sm },
    badgeConfirmed: { backgroundColor: theme.colors.success + '20' },
    badgePending: { backgroundColor: theme.colors.primaryLight },
    badgeText: { fontFamily: theme.typography.fontFamily.medium, fontSize: 10 },
    badgeTextConfirmed: { color: theme.colors.success },
    badgeTextPending: { color: theme.colors.primary },
    meetingInfo: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    meetingDetails: { flex: 1 },
    meetingProvider: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
    },
    meetingService: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.primary,
      marginTop: 4,
    },
    pendingActions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
      paddingTop: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    pendingBtn: { flex: 1 },
    bottomSpacer: { height: 110 },
  });
}
