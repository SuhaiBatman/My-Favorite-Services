import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import { useFullScreenSheetTopInset } from '../hooks/use-full-screen-sheet-top-inset';
import { Button } from './Button';
import { BookingCalendar } from './BookingCalendar';
import {
  listProviderAppointmentsBetween,
  requestAppointmentReschedule,
  type Appointment,
} from '../lib/appointments';
import { listEmployeeAvailability } from '../lib/employeeServices';
import type { ProviderAvailabilitySlot } from '../lib/profileSchedule';
import { formatAppointmentDate, formatAppointmentTime } from '../lib/format';

const SLOT_INTERVAL_MINUTES = 30;

function parseTime12ToMinutes(time12: string): number {
  const [time, meridiemRaw] = time12.split(' ');
  const [hourRaw, minuteRaw] = time.split(':');
  let hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const meridiem = meridiemRaw?.toUpperCase();
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function buildStartsAt(date: Date, time12: string): Date {
  const mins = parseTime12ToMinutes(time12);
  const d = new Date(date);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfLocalDay(date: Date): Date {
  const d = startOfLocalDay(date);
  d.setDate(d.getDate() + 1);
  return d;
}

function minutesToTime12(minutes: number): string {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
}

function roundUpToInterval(minutes: number, interval: number): number {
  return Math.ceil(minutes / interval) * interval;
}

function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && endA > startB;
}

type RescheduleAppointmentModalProps = {
  appointment: Appointment | null;
  visible: boolean;
  requestedById: string | null;
  onClose: () => void;
  onRescheduled: () => void;
};

export function RescheduleAppointmentModal({
  appointment,
  visible,
  requestedById,
  onClose,
  onRescheduled,
}: RescheduleAppointmentModalProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const topInset = useFullScreenSheetTopInset();

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availabilitySlots, setAvailabilitySlots] = useState<ProviderAvailabilitySlot[]>([]);
  const [bookedAppointments, setBookedAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const durationMins = useMemo(() => {
    if (!appointment) return 45;
    const start = new Date(appointment.starts_at).getTime();
    const end = new Date(appointment.ends_at).getTime();
    return Math.max(15, Math.round((end - start) / 60000));
  }, [appointment]);

  useEffect(() => {
    if (!visible || !appointment) return;
    setSelectedDate(null);
    setSelectedTime(null);
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const availability = await listEmployeeAvailability(appointment.provider_id);
        if (!cancelled) setAvailabilitySlots(availability);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointment, visible]);

  useEffect(() => {
    if (!visible || !appointment || !selectedDate) {
      setBookedAppointments([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await listProviderAppointmentsBetween(
          appointment.provider_id,
          startOfLocalDay(selectedDate),
          endOfLocalDay(selectedDate)
        );
        if (!cancelled) {
          setBookedAppointments(rows.filter((row) => row.id !== appointment.id));
        }
      } catch {
        if (!cancelled) setBookedAppointments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointment, selectedDate, visible]);

  const availableDaysOfWeek = useMemo(
    () => [...new Set(availabilitySlots.map((slot) => slot.day_of_week))],
    [availabilitySlots]
  );

  const timeOptions = useMemo(() => {
    if (!selectedDate) return [];
    const daySlots = availabilitySlots.filter(
      (slot) => slot.day_of_week === selectedDate.getDay()
    );
    if (daySlots.length === 0) return [];

    const now = new Date();
    const isToday = startOfLocalDay(now).getTime() === selectedDate.getTime();
    const earliestTodayMinutes = isToday
      ? roundUpToInterval(now.getHours() * 60 + now.getMinutes(), SLOT_INTERVAL_MINUTES)
      : 0;
    const options: string[] = [];

    daySlots.forEach((slot) => {
      const startMinute = Math.max(
        slot.start_minutes,
        roundUpToInterval(slot.start_minutes, SLOT_INTERVAL_MINUTES),
        earliestTodayMinutes
      );
      const latestStart = slot.end_minutes - durationMins;

      for (let mins = startMinute; mins <= latestStart; mins += SLOT_INTERVAL_MINUTES) {
        const startsAt = buildStartsAt(selectedDate, minutesToTime12(mins));
        const endsAt = new Date(startsAt.getTime() + durationMins * 60 * 1000);
        const conflict = bookedAppointments.some((appt) =>
          rangesOverlap(
            startsAt,
            endsAt,
            new Date(appt.starts_at),
            new Date(appt.ends_at)
          )
        );
        if (!conflict) options.push(minutesToTime12(mins));
      }
    });

    return [...new Set(options)];
  }, [availabilitySlots, bookedAppointments, durationMins, selectedDate]);

  const startsAt =
    selectedDate && selectedTime ? buildStartsAt(selectedDate, selectedTime) : null;
  const endsAt = startsAt
    ? new Date(startsAt.getTime() + durationMins * 60 * 1000)
    : null;

  const handleSubmit = async () => {
    if (!appointment || !startsAt || !endsAt || !requestedById) return;
    setSubmitting(true);
    try {
      await requestAppointmentReschedule({
        appointmentId: appointment.id,
        startsAt,
        endsAt,
        requestedById,
      });
      onRescheduled();
      onClose();
    } catch {
      Alert.alert('Error', 'Could not request a reschedule. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!appointment) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: topInset }]}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Reschedule</Text>
            <Text style={styles.subtitle}>{appointment.service_name}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.currentCard}>
            <Text style={styles.currentLabel}>Current time</Text>
            <Text style={styles.currentValue}>
              {formatAppointmentDate(appointment.starts_at)} ·{' '}
              {formatAppointmentTime(appointment.starts_at)}
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color={theme.colors.secondary} style={styles.loader} />
          ) : (
            <>
              <Text style={styles.sectionLabel}>New date</Text>
              <BookingCalendar
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                availableDaysOfWeek={availableDaysOfWeek}
              />

              <Text style={styles.sectionLabel}>New time</Text>
              {!selectedDate ? (
                <Text style={styles.helperText}>Select a date to view available times.</Text>
              ) : timeOptions.length === 0 ? (
                <Text style={styles.helperText}>No available times on this day.</Text>
              ) : (
                <View style={styles.wrapRow}>
                  {timeOptions.map((time) => {
                    const active = time === selectedTime;
                    return (
                      <TouchableOpacity
                        key={time}
                        style={[styles.pill, active && styles.pillActive]}
                        onPress={() => setSelectedTime(time)}
                      >
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>{time}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Button
                title="Request reschedule"
                onPress={handleSubmit}
                loading={submitting}
                disabled={!startsAt || !endsAt || submitting}
                style={styles.submit}
              />
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    headerText: { flex: 1, marginRight: theme.spacing.md },
    title: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.sizes.title,
      color: theme.colors.textPrimary,
    },
    subtitle: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
    currentCard: {
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      marginBottom: theme.spacing.md,
    },
    currentLabel: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    currentValue: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
    },
    sectionLabel: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    helperText: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.textSecondary,
    },
    loader: { marginVertical: theme.spacing.lg },
    wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    pillActive: {
      backgroundColor: theme.colors.secondary,
      borderColor: theme.colors.secondary,
    },
    pillText: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textPrimary,
    },
    pillTextActive: { color: theme.colors.bubbleSentText },
    submit: { marginTop: theme.spacing.lg },
  });
}
