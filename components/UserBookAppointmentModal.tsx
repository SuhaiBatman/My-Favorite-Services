import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import { useFullScreenSheetTopInset } from '../hooks/use-full-screen-sheet-top-inset';
import { Button } from './Button';
import { ProviderAvatar } from './ProviderAvatar';
import { useAuth } from '../contexts/AuthContext';
import {
  createAppointment,
  listProviderAppointmentsBetween,
  listUserUpcomingWithProvider,
  type Appointment,
} from '../lib/appointments';
import { listEmployeeAvailability, listEmployeeServices, type EmployeeService } from '../lib/employeeServices';
import { formatServiceDuration, formatServicePrice } from '../lib/serviceOffer';
import { BookingCalendar } from './BookingCalendar';
import { ServiceBookingFields } from './ServiceBookingFields';
import { listMessageableProviders, type ProviderListItem } from '../lib/messaging';
import { profileDisplayName, formatAppointmentDate, formatAppointmentTime } from '../lib/format';
import type { ProviderAvailabilitySlot } from '../lib/profileSchedule';
import {
  buildAppointmentLocation,
  getFieldsForTemplate,
  getInputFields,
  getTimeFields,
  inferTemplateFromServiceName,
  isBookingComplete,
  isBrickAndMortarTemplate,
  needsUserProvidedAddresses,
  type BookingDetails,
  type BookingFieldKey,
} from '../lib/serviceBookingFields';

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

function roundUpToInterval(minutes: number, interval: number): number {
  return Math.ceil(minutes / interval) * interval;
}

function minutesToTime12(minutes: number): string {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
}

function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && endA > startB;
}

function hasAppointmentConflict(
  startsAt: Date,
  endsAt: Date,
  appointments: Appointment[]
): boolean {
  return appointments.some((appointment) =>
    rangesOverlap(
      startsAt,
      endsAt,
      new Date(appointment.starts_at),
      new Date(appointment.ends_at)
    )
  );
}

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function providerSubtitle(
  p: Pick<ProviderListItem, 'job_title' | 'business_name'>
): string {
  return p.job_title || p.business_name || 'Service Provider';
}

type BookingProviderSummary = Pick<
  ProviderListItem,
  'id' | 'first_name' | 'last_name' | 'job_title' | 'business_name' | 'location'
>;

function providerSearchText(p: ProviderListItem): string {
  return [
    profileDisplayName(p.first_name, p.last_name),
    p.job_title,
    p.business_name,
    p.industry,
    p.services,
    p.location,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

type UserBookAppointmentModalProps = {
  visible: boolean;
  onClose: () => void;
  onBooked: () => void;
  initialProviderId?: string | null;
  initialProvider?: BookingProviderSummary | null;
};

export function UserBookAppointmentModal({
  visible,
  onClose,
  onBooked,
  initialProviderId = null,
  initialProvider = null,
}: UserBookAppointmentModalProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const topInset = useFullScreenSheetTopInset();

  const { user } = useAuth();
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [services, setServices] = useState<EmployeeService[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [providerId, setProviderId] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookingDetails, setBookingDetails] = useState<BookingDetails>({});
  const [notes, setNotes] = useState('');
  const [providerSearch, setProviderSearch] = useState('');
  const [availabilitySlots, setAvailabilitySlots] = useState<ProviderAvailabilitySlot[]>([]);
  const [bookedAppointments, setBookedAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [appointmentCheckError, setAppointmentCheckError] = useState<string | null>(null);
  const [existingWithProvider, setExistingWithProvider] = useState<Appointment[]>([]);

  const providerSelected = providerId !== null;

  const bookingTemplate = useMemo(
    () => (serviceName ? inferTemplateFromServiceName(serviceName) : 'simple_appointment'),
    [serviceName]
  );
  const bookingFields = useMemo(
    () => getFieldsForTemplate(bookingTemplate),
    [bookingTemplate]
  );
  const addressInputFields = useMemo(() => getInputFields(bookingFields), [bookingFields]);
  const additionalTimeFields = useMemo(
    () =>
      getTimeFields(bookingFields).filter((field) =>
        bookingTemplate === 'ride'
          ? field.key !== 'pickupTime'
          : field.key !== 'startTime'
      ),
    [bookingFields, bookingTemplate]
  );
  const showProviderLocation = isBrickAndMortarTemplate(bookingTemplate);
  const showAddressFields = needsUserProvidedAddresses(bookingTemplate);
  const selectedService = services.find((service) => service.name === serviceName);
  const durationMins = selectedService?.durationMinutes ?? 45;

  const availableDaysOfWeek = useMemo(
    () => [...new Set(availabilitySlots.map((slot) => slot.day_of_week))],
    [availabilitySlots]
  );

  const filteredProviders = useMemo(() => {
    const q = providerSearch.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter((p) => providerSearchText(p).includes(q));
  }, [providers, providerSearch]);

  useEffect(() => {
    if (!visible) return;
    setProviderId(initialProviderId ?? null);
    let cancelled = false;
    (async () => {
      setLoadingProviders(true);
      try {
        const list = await listMessageableProviders();
        if (!cancelled) setProviders(list);
      } finally {
        if (!cancelled) setLoadingProviders(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialProviderId, visible]);

  useEffect(() => {
    if (!visible) {
      setProviderId(null);
      setServiceName(null);
      setSelectedDate(null);
      setSelectedTime(null);
      setBookingDetails({});
      setNotes('');
      setServices([]);
      setProviderSearch('');
      setAvailabilitySlots([]);
      setBookedAppointments([]);
      setBookingError(null);
      setAppointmentCheckError(null);
      setExistingWithProvider([]);
    }
  }, [visible]);

  useEffect(() => {
    if (!providerId) {
      setServices([]);
      setServiceName(null);
      setAvailabilitySlots([]);
      setBookedAppointments([]);
      setBookingError(null);
      setAppointmentCheckError(null);
      setExistingWithProvider([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingServices(true);
      setBookingError(null);
      setAppointmentCheckError(null);
      setExistingWithProvider([]);
      try {
        const [serviceList, availability] = await Promise.all([
          listEmployeeServices(providerId),
          listEmployeeAvailability(providerId),
        ]);
        if (!cancelled) {
          setServices(serviceList);
          setServiceName(serviceList[0]?.name ?? null);
          setAvailabilitySlots(availability);
          setSelectedDate(null);
          setSelectedTime(null);
          setBookedAppointments([]);
          setBookingDetails({});
          setAppointmentCheckError(null);
      setExistingWithProvider([]);
        }
      } catch {
        if (!cancelled) {
          setServices([]);
          setAvailabilitySlots([]);
          setBookingError('Could not load this provider’s booking details. Please try again.');
        }
      } finally {
        if (!cancelled) setLoadingServices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [providerId]);

  useEffect(() => {
    if (!visible || !providerId || !user?.id) {
      setExistingWithProvider([]);
      return;
    }
    let cancelled = false;
    void listUserUpcomingWithProvider(user.id, providerId)
      .then((rows) => {
        if (!cancelled) setExistingWithProvider(rows);
      })
      .catch(() => {
        if (!cancelled) setExistingWithProvider([]);
      });
    return () => {
      cancelled = true;
    };
  }, [providerId, user?.id, visible]);

  const selectedProvider = providers.find((p) => p.id === providerId);
  const selectedProviderSummary = selectedProvider ?? initialProvider;
  const providerLabel = selectedProviderSummary
    ? profileDisplayName(selectedProviderSummary.first_name, selectedProviderSummary.last_name)
    : '';

  const clearProviderSelection = () => {
    setProviderId(null);
    setServiceName(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setBookingDetails({});
    setNotes('');
    setBookingError(null);
    setAppointmentCheckError(null);
  };

  const setBookingDetail = (key: BookingFieldKey, value: string) => {
    setBookingDetails((prev) => ({ ...prev, [key]: value }));
  };

  const clearAdditionalTimes = () => {
    setBookingDetails((prev) => {
      const next = { ...prev };
      delete next.endTime;
      delete next.dropoffTime;
      return next;
    });
  };

  const selectPrimaryTime = (time: string) => {
    setSelectedTime(time);
    clearAdditionalTimes();
  };

  useEffect(() => {
    setBookingDetails({});
    setSelectedDate(null);
    setSelectedTime(null);
    setBookedAppointments([]);
  }, [serviceName]);

  useEffect(() => {
    setSelectedTime(null);
    setBookingDetails((prev) => {
      const next = { ...prev };
      delete next.startTime;
      delete next.pickupTime;
      delete next.endTime;
      delete next.dropoffTime;
      return next;
    });
  }, [selectedDate]);

  useEffect(() => {
    if (!visible || !providerId || !selectedDate) {
      setBookedAppointments([]);
      setAppointmentCheckError(null);
      setExistingWithProvider([]);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingAppointments(true);
      setAppointmentCheckError(null);
      setExistingWithProvider([]);
      try {
        const appointments = await listProviderAppointmentsBetween(
          providerId,
          startOfLocalDay(selectedDate),
          endOfLocalDay(selectedDate)
        );
        if (!cancelled) setBookedAppointments(appointments);
      } catch {
        if (!cancelled) {
          setBookedAppointments([]);
          setAppointmentCheckError('Could not check this day’s booked times. Please try again.');
        }
      } finally {
        if (!cancelled) setLoadingAppointments(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [providerId, selectedDate, visible]);

  const detailsForValidation = useMemo(() => {
    const merged: BookingDetails = { ...bookingDetails };
    if (selectedTime) {
      if (bookingTemplate === 'ride') {
        merged.pickupTime = selectedTime;
      } else {
        merged.startTime = selectedTime;
      }
    }
    return merged;
  }, [bookingDetails, selectedTime, bookingTemplate]);

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
    const minimumSlotMinutes =
      bookingTemplate === 'windowed_appointment' ? SLOT_INTERVAL_MINUTES : durationMins;
    const options: string[] = [];

    daySlots.forEach((slot) => {
      const startMinute = Math.max(
        slot.start_minutes,
        roundUpToInterval(slot.start_minutes, SLOT_INTERVAL_MINUTES),
        earliestTodayMinutes
      );
      const latestStart = slot.end_minutes - minimumSlotMinutes;

      for (let mins = startMinute; mins <= latestStart; mins += SLOT_INTERVAL_MINUTES) {
        const startsAt = buildStartsAt(selectedDate, minutesToTime12(mins));
        const endsAt = new Date(startsAt.getTime() + minimumSlotMinutes * 60 * 1000);
        if (!hasAppointmentConflict(startsAt, endsAt, bookedAppointments)) {
          options.push(minutesToTime12(mins));
        }
      }
    });

    return [...new Set(options)];
  }, [availabilitySlots, bookedAppointments, bookingTemplate, durationMins, selectedDate]);

  useEffect(() => {
    if (selectedTime && !timeOptions.includes(selectedTime)) {
      setSelectedTime(null);
      setBookingDetails((prev) => {
        const next = { ...prev };
        delete next.startTime;
        delete next.pickupTime;
        delete next.endTime;
        delete next.dropoffTime;
        return next;
      });
    }
  }, [selectedTime, timeOptions]);

  const getAdditionalTimeOptions = (fieldKey: BookingFieldKey) => {
    if (!selectedDate || !selectedTime) return [];

    const selectedMinutes = parseTime12ToMinutes(selectedTime);
    const selectedSlot = availabilitySlots.find(
      (slot) =>
        slot.day_of_week === selectedDate.getDay() &&
        selectedMinutes >= slot.start_minutes &&
        selectedMinutes < slot.end_minutes
    );
    if (!selectedSlot) return [];

    const options: string[] = [];
    const earliest = selectedMinutes + SLOT_INTERVAL_MINUTES;
    for (let mins = earliest; mins <= selectedSlot.end_minutes; mins += SLOT_INTERVAL_MINUTES) {
      if (fieldKey === 'endTime') {
        const startsAt = buildStartsAt(selectedDate, selectedTime);
        const endsAt = buildStartsAt(selectedDate, minutesToTime12(mins));
        if (endsAt <= startsAt || hasAppointmentConflict(startsAt, endsAt, bookedAppointments)) {
          continue;
        }
      }
      options.push(minutesToTime12(mins));
    }
    return options;
  };

  const startsAt = useMemo(() => {
    if (!selectedDate || !selectedTime) return null;
    return buildStartsAt(selectedDate, selectedTime);
  }, [selectedDate, selectedTime]);

  const endsAt = useMemo(() => {
    if (!startsAt || !selectedDate) return null;
    if (bookingTemplate === 'windowed_appointment' && bookingDetails.endTime) {
      return buildStartsAt(selectedDate, bookingDetails.endTime);
    }
    return new Date(startsAt.getTime() + durationMins * 60 * 1000);
  }, [bookingDetails.endTime, bookingTemplate, durationMins, selectedDate, startsAt]);

  const hasSelectedTimeConflict = Boolean(
    startsAt && endsAt && hasAppointmentConflict(startsAt, endsAt, bookedAppointments)
  );
  const selectedEndIsAfterStart = Boolean(startsAt && endsAt && endsAt > startsAt);

  const canSubmit =
    Boolean(user?.id) &&
    Boolean(providerId) &&
    Boolean(serviceName) &&
    selectedDate !== null &&
    selectedTime !== null &&
    startsAt !== null &&
    endsAt !== null &&
    selectedEndIsAfterStart &&
    !hasSelectedTimeConflict &&
    !loadingAppointments &&
    !bookingError &&
    !appointmentCheckError &&
    !submitting &&
    isBookingComplete(bookingFields, detailsForValidation, selectedDate);

  const handleSubmit = async () => {
    if (!canSubmit || !user?.id || !providerId || !serviceName || !startsAt || !endsAt) {
      return;
    }

    setSubmitting(true);
    try {
      const latestAppointments = await listProviderAppointmentsBetween(
        providerId,
        startOfLocalDay(startsAt),
        endOfLocalDay(startsAt)
      );
      setBookedAppointments(latestAppointments);
      if (hasAppointmentConflict(startsAt, endsAt, latestAppointments)) {
        Alert.alert(
          'Time no longer available',
          'That appointment time was just booked. Please choose another slot.'
        );
        return;
      }

      await createAppointment({
        userId: user.id,
        providerId,
        serviceName,
        startsAt,
        endsAt,
        status: 'pending',
        location: buildAppointmentLocation(
          bookingTemplate,
          detailsForValidation,
          selectedProviderSummary?.location
        ),
        notes: notes.trim() || null,
      });
      onBooked();
      onClose();
    } catch (error) {
      if (getErrorCode(error) === '23P01') {
        Alert.alert(
          'Time no longer available',
          'That appointment overlaps another booking. Please choose another slot.'
        );
      } else {
        Alert.alert('Booking failed', 'Could not create the appointment. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: topInset }]}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Book appointment</Text>
            <Text style={styles.subtitle}>
              {providerSelected ? 'Choose service, date & time' : 'Choose a provider'}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {providerSelected && selectedProviderSummary ? (
          <View style={styles.selectedProviderBar}>
            <ProviderAvatar name={providerLabel} size={44} />
            <View style={styles.selectedProviderInfo}>
              <Text style={styles.selectedProviderName}>{providerLabel}</Text>
              <Text style={styles.selectedProviderRole} numberOfLines={1}>
                {providerSubtitle(selectedProviderSummary)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.changeProviderBtn}
              onPress={clearProviderSelection}
              hitSlop={8}
            >
              <Text style={styles.changeProviderText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {providerSelected && existingWithProvider.length > 0 ? (
          <View style={styles.existingBanner}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.secondary} />
            <View style={styles.existingBannerText}>
              <Text style={styles.existingBannerTitle}>
                You already have {existingWithProvider.length} upcoming appointment
                {existingWithProvider.length === 1 ? '' : 's'} with this provider
              </Text>
              <Text style={styles.existingBannerSubtitle} numberOfLines={2}>
                Next: {formatAppointmentDate(existingWithProvider[0].starts_at)} ·{' '}
                {formatAppointmentTime(existingWithProvider[0].starts_at)} —{' '}
                {existingWithProvider[0].service_name}
              </Text>
            </View>
          </View>
        ) : null}

        {!providerSelected ? (
          <View style={styles.providerPickerBody}>
            <View style={styles.providerToolbar}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color={theme.colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search name, specialty, or business"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={providerSearch}
                  onChangeText={setProviderSearch}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {providerSearch.length > 0 ? (
                  <TouchableOpacity onPress={() => setProviderSearch('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <ScrollView
              style={styles.providerListScroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {loadingProviders ? (
                <View style={styles.loadingBlock}>
                  <ActivityIndicator size="large" color={theme.colors.secondary} />
                </View>
              ) : providers.length === 0 ? (
                <View style={styles.emptyBlock}>
                  <Ionicons name="people-outline" size={40} color={theme.colors.border} />
                  <Text style={styles.emptyTitle}>No providers available</Text>
                  <Text style={styles.emptySubtitle}>Check back later or scan a provider QR code.</Text>
                </View>
              ) : filteredProviders.length === 0 ? (
                <View style={styles.emptyBlock}>
                  <Ionicons name="search-outline" size={40} color={theme.colors.border} />
                  <Text style={styles.emptyTitle}>No matches</Text>
                  <Text style={styles.emptySubtitle}>
                    Try a different name, specialty, or business.
                  </Text>
                  <TouchableOpacity
                    style={styles.clearFiltersBtn}
                    onPress={() => setProviderSearch('')}
                  >
                    <Text style={styles.clearFiltersText}>Clear search</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                filteredProviders.map((p) => {
                  const name = profileDisplayName(p.first_name, p.last_name);
                  const subtitle = providerSubtitle(p);
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.providerRow}
                      activeOpacity={0.7}
                      onPress={() => setProviderId(p.id)}
                    >
                      <ProviderAvatar name={name} size={48} />
                      <View style={styles.providerRowInfo}>
                        <Text style={styles.providerRowName}>{name}</Text>
                        <Text style={styles.providerRowSubtitle} numberOfLines={1}>
                          {subtitle}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <>
              <Text style={styles.sectionLabel}>Service</Text>
              {loadingServices ? (
                <ActivityIndicator color={theme.colors.secondary} style={styles.inlineLoader} />
              ) : bookingError ? (
                <View style={styles.noticeCard}>
                  <Ionicons name="alert-circle-outline" size={20} color={theme.colors.destructive} />
                  <Text style={styles.noticeText}>{bookingError}</Text>
                </View>
              ) : services.length === 0 ? (
                <View style={styles.noticeCard}>
                  <Ionicons name="briefcase-outline" size={20} color={theme.colors.textSecondary} />
                  <Text style={styles.noticeText}>
                    This provider has not listed bookable services yet.
                  </Text>
                </View>
              ) : (
                <View style={styles.wrapRow}>
                  {services.map((service) => {
                    const active = service.name === serviceName;
                    const meta = [
                      service.durationMinutes ? formatServiceDuration(service.durationMinutes) : null,
                      service.priceCents != null ? formatServicePrice(service.priceCents) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <TouchableOpacity
                        key={service.id}
                        style={[styles.pill, active && styles.pillActive]}
                        onPress={() => setServiceName(service.name)}
                      >
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>
                          {service.name}
                        </Text>
                        {meta ? (
                          <Text style={[styles.pillMeta, active && styles.pillMetaActive]}>{meta}</Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {serviceName ? (
                <>
              <Text style={styles.sectionLabel}>Date</Text>
              <BookingCalendar
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                availableDaysOfWeek={availableDaysOfWeek}
              />
              {!loadingServices && availabilitySlots.length === 0 ? (
                <Text style={styles.helperText}>
                  This provider has not listed bookable hours yet.
                </Text>
              ) : null}

              <Text style={styles.sectionLabel}>Time</Text>
              {!selectedDate ? (
                <Text style={styles.helperText}>Select a date to view available times.</Text>
              ) : loadingAppointments ? (
                <ActivityIndicator color={theme.colors.secondary} style={styles.inlineLoader} />
              ) : appointmentCheckError ? (
                <View style={styles.noticeCard}>
                  <Ionicons name="alert-circle-outline" size={20} color={theme.colors.destructive} />
                  <Text style={styles.noticeText}>{appointmentCheckError}</Text>
                </View>
              ) : timeOptions.length === 0 ? (
                <View style={styles.noticeCard}>
                  <Ionicons name="time-outline" size={20} color={theme.colors.textSecondary} />
                  <Text style={styles.noticeText}>
                    No available times remain for this date. Choose another available day.
                  </Text>
                </View>
              ) : (
                <View style={styles.wrapRow}>
                  {timeOptions.map((t) => {
                    const active = t === selectedTime;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.pill, active && styles.pillActive]}
                        onPress={() => selectPrimaryTime(t)}
                      >
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {selectedTime && additionalTimeFields.length > 0 ? (
                additionalTimeFields.map((field) => {
                  const options = getAdditionalTimeOptions(field.key);
                  const value = bookingDetails[field.key] ?? null;
                  return (
                    <View key={field.key}>
                      <Text style={styles.sectionLabel}>
                        {field.label}
                        {!field.required ? (
                          <Text style={styles.optionalLabel}> (optional)</Text>
                        ) : null}
                      </Text>
                      {options.length === 0 ? (
                        <Text style={styles.helperText}>No later times are available.</Text>
                      ) : (
                        <View style={styles.wrapRow}>
                          {options.map((t) => {
                            const active = t === value;
                            return (
                              <TouchableOpacity
                                key={`${field.key}-${t}`}
                                style={[styles.pill, active && styles.pillActive]}
                                onPress={() => setBookingDetail(field.key, active ? '' : t)}
                              >
                                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                                  {t}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })
              ) : null}

              {hasSelectedTimeConflict ? (
                <Text style={styles.errorText}>
                  That time is no longer available. Choose another slot.
                </Text>
              ) : null}

              {showProviderLocation ? (
                <>
                  <Text style={styles.sectionLabel}>Location</Text>
                  <View style={styles.providerLocationCard}>
                    <Ionicons name="storefront-outline" size={20} color={theme.colors.secondary} />
                    <View style={styles.providerLocationText}>
                      <Text style={styles.providerLocationTitle}>Visit the business</Text>
                      <Text style={styles.providerLocationValue}>
                        {selectedProviderSummary?.location?.trim() ||
                          'Address not listed — contact the provider.'}
                      </Text>
                    </View>
                  </View>
                </>
              ) : null}

              {showAddressFields && addressInputFields.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>
                    {bookingTemplate === 'ride' ? 'Trip details' : 'Service location'}
                  </Text>
                  <ServiceBookingFields
                    fields={addressInputFields}
                    values={bookingDetails}
                    onChange={setBookingDetail}
                  />
                </>
              ) : null}

              <Text style={styles.sectionLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="Anything your provider should know"
                placeholderTextColor={theme.colors.textSecondary}
                value={notes}
                onChangeText={setNotes}
                multiline
              />

              <Button
                title="Confirm booking"
                onPress={handleSubmit}
                loading={submitting}
                disabled={!canSubmit}
                style={styles.submit}
              />
                </>
              ) : null}
            </>
          </ScrollView>
        )}
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
  selectedProviderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  selectedProviderInfo: { flex: 1 },
  selectedProviderName: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
  },
  selectedProviderRole: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  changeProviderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  changeProviderText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.secondary,
  },
  existingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  existingBannerText: { flex: 1, gap: 4 },
  existingBannerTitle: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textPrimary,
  },
  existingBannerSubtitle: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  providerPickerBody: {
    flex: 1,
  },
  providerToolbar: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
    padding: 0,
  },
  providerListScroll: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  clearFiltersBtn: {
    marginTop: theme.spacing.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  clearFiltersText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.secondary,
  },
  loadingBlock: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyBlock: {
    alignItems: 'center',
    paddingVertical: 48,
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
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  providerRowInfo: { flex: 1 },
  providerRowName: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
  },
  providerRowSubtitle: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  inlineLoader: { marginVertical: theme.spacing.md },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  noticeText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  helperText: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.destructive,
    marginTop: theme.spacing.sm,
  },
  optionalLabel: {
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
  },
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
  pillMeta: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  pillMetaActive: { color: theme.colors.bubbleSentText, opacity: 0.85 },
  providerLocationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  providerLocationText: { flex: 1, gap: 4 },
  providerLocationTitle: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
  },
  providerLocationValue: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  submit: { marginTop: theme.spacing.lg },
  });
}
