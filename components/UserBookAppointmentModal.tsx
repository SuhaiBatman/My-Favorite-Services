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
import { Button } from './Button';
import { ProviderAvatar } from './ProviderAvatar';
import { useAuth } from '../contexts/AuthContext';
import { createAppointment } from '../lib/appointments';
import { listEmployeeAvailability, listEmployeeServices } from '../lib/employeeServices';
import { BookingCalendar } from './BookingCalendar';
import { ServiceBookingFields } from './ServiceBookingFields';
import { listMessageableProviders, type ProviderListItem } from '../lib/messaging';
import { profileDisplayName } from '../lib/format';
import {
  buildAppointmentLocation,
  getFieldsForTemplate,
  getInputFields,
  inferTemplateFromServiceName,
  isBookingComplete,
  isBrickAndMortarTemplate,
  needsUserProvidedAddresses,
  type BookingDetails,
  type BookingFieldKey,
} from '../lib/serviceBookingFields';

const TIME_SLOTS = ['09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'];

const DURATION_BY_SERVICE: Record<string, number> = {
  'initial consultation': 30,
  'follow-up visit': 15,
  'acne treatment': 45,
  'the signature cut': 45,
  'beard trim': 20,
  'hot towel shave': 30,
  'deep tissue massage': 60,
  'relaxation massage': 45,
  'sports recovery': 60,
  'strength & conditioning': 50,
  'hiit session': 45,
  'mobility assessment': 30,
  'meal plan review': 45,
  'initial nutrition consult': 60,
  'follow-up check-in': 30,
  'full color & toner': 90,
  'cut & style': 45,
  'root touch-up': 60,
  'injury assessment': 30,
  'performance screening': 45,
  'hydrafacial treatment': 75,
  'chemical peel': 60,
  'custom facial': 50,
  'standard ride': 60,
  'airport transfer': 75,
  'hourly charter': 60,
  'standard home clean': 180,
  'deep clean': 300,
  'move-out clean': 240,
};

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

function providerSubtitle(p: ProviderListItem): string {
  return p.job_title || p.business_name || 'Service Provider';
}

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
};

export function UserBookAppointmentModal({
  visible,
  onClose,
  onBooked,
}: UserBookAppointmentModalProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const { user } = useAuth();
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
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
  const [availableDaysOfWeek, setAvailableDaysOfWeek] = useState<number[]>([]);

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
  const showProviderLocation = isBrickAndMortarTemplate(bookingTemplate);
  const showAddressFields = needsUserProvidedAddresses(bookingTemplate);

  const filteredProviders = useMemo(() => {
    const q = providerSearch.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter((p) => providerSearchText(p).includes(q));
  }, [providers, providerSearch]);

  useEffect(() => {
    if (!visible) return;
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
  }, [visible]);

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
      setAvailableDaysOfWeek([]);
    }
  }, [visible]);

  useEffect(() => {
    if (!providerId) {
      setServices([]);
      setServiceName(null);
      setAvailableDaysOfWeek([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingServices(true);
      try {
        const [serviceList, availability] = await Promise.all([
          listEmployeeServices(providerId),
          listEmployeeAvailability(providerId),
        ]);
        if (!cancelled) {
          setServices(serviceList);
          setServiceName(serviceList[0]?.name ?? null);
          setAvailableDaysOfWeek(availability);
          setSelectedDate(null);
          setSelectedTime(null);
          setBookingDetails({});
        }
      } finally {
        if (!cancelled) setLoadingServices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [providerId]);

  const selectedProvider = providers.find((p) => p.id === providerId);
  const providerLabel = selectedProvider
    ? profileDisplayName(selectedProvider.first_name, selectedProvider.last_name)
    : '';

  const clearProviderSelection = () => {
    setProviderId(null);
    setServiceName(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setBookingDetails({});
    setNotes('');
  };

  const setBookingDetail = (key: BookingFieldKey, value: string) => {
    setBookingDetails((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    setBookingDetails({});
  }, [serviceName]);

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

  const canSubmit =
    Boolean(user?.id) &&
    Boolean(providerId) &&
    Boolean(serviceName) &&
    selectedDate !== null &&
    selectedTime !== null &&
    !submitting &&
    isBookingComplete(bookingFields, detailsForValidation, selectedDate);

  const handleSubmit = async () => {
    if (!canSubmit || !user?.id || !providerId || !serviceName || !selectedDate || !selectedTime) {
      return;
    }

    const durationMins = DURATION_BY_SERVICE[serviceName.toLowerCase()] ?? 45;
    const startsAt = buildStartsAt(selectedDate, selectedTime);
    const endsAt = new Date(startsAt.getTime() + durationMins * 60 * 1000);

    setSubmitting(true);
    try {
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
          selectedProvider?.location
        ),
        notes: notes.trim() || null,
      });
      onBooked();
      onClose();
    } catch {
      Alert.alert('Booking failed', 'Could not create the appointment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
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

        {providerSelected && selectedProvider ? (
          <View style={styles.selectedProviderBar}>
            <ProviderAvatar name={providerLabel} size={44} />
            <View style={styles.selectedProviderInfo}>
              <Text style={styles.selectedProviderName}>{providerLabel}</Text>
              <Text style={styles.selectedProviderRole} numberOfLines={1}>
                {providerSubtitle(selectedProvider)}
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
              ) : (
                <View style={styles.wrapRow}>
                  {services.map((s) => {
                    const active = s.name === serviceName;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.pill, active && styles.pillActive]}
                        onPress={() => setServiceName(s.name)}
                      >
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>{s.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={styles.sectionLabel}>Date</Text>
              <BookingCalendar
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                availableDaysOfWeek={
                  availableDaysOfWeek.length > 0 ? availableDaysOfWeek : null
                }
              />

              <Text style={styles.sectionLabel}>Time</Text>
              <View style={styles.wrapRow}>
                {TIME_SLOTS.map((t) => {
                  const active = t === selectedTime;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.pill, active && styles.pillActive]}
                      onPress={() => setSelectedTime(t)}
                    >
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {showProviderLocation ? (
                <>
                  <Text style={styles.sectionLabel}>Location</Text>
                  <View style={styles.providerLocationCard}>
                    <Ionicons name="storefront-outline" size={20} color={theme.colors.secondary} />
                    <View style={styles.providerLocationText}>
                      <Text style={styles.providerLocationTitle}>Visit the business</Text>
                      <Text style={styles.providerLocationValue}>
                        {selectedProvider?.location?.trim() ||
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
    paddingTop: theme.spacing.lg,
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