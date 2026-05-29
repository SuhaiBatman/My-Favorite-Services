import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '../../constants/theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../hooks/use-themed-styles';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { ServiceBookingFields } from '../../components/ServiceBookingFields';
import { BookingTimeSlots } from '../../components/BookingTimeSlots';
import { useAuth } from '../../contexts/AuthContext';
import UserScheduleScreen from '../../components/screens/user/UserScheduleScreen';
import EmployeeScheduleScreen from '../../components/screens/employee/EmployeeScheduleScreen';
import {
  type BookingDetails,
  type BookingFieldKey,
  type ServiceBookingTemplate,
  formatDateForSummary,
  getDateFields,
  getDetailValue,
  getFieldsForTemplate,
  getInputFields,
  getTimeFields,
  hasDateField,
  isBookingComplete,
} from '../../lib/serviceBookingFields';

type MockService = {
  id: string;
  name: string;
  duration: string;
  price: number;
  bookingTemplate: ServiceBookingTemplate;
};

type MockProvider = {
  id: string;
  name: string;
  role: string;
  rating: number;
  reviews: number;
  services: MockService[];
  unavailableDays: number[];
  unavailableDates: string[];
};

// --- MOCK DATA ---
const UPCOMING_MEETINGS = [
  { id: '1', provider: 'Dr. Elena Sterling', service: 'Initial Consultation', date: 'Oct 12, 2026', time: '10:30 AM', role: 'Senior Dermatologist', status: 'Confirmed' },
  { id: '2', provider: 'Julian Vance', service: 'The Signature Cut', date: 'Oct 15, 2026', time: '3:00 PM', role: 'Master Barber', status: 'Pending' },
];

const MOCK_PROVIDERS: MockProvider[] = [
  {
    id: 'p1',
    name: 'Dr. Elena Sterling',
    role: 'Senior Dermatologist',
    rating: 4.9,
    reviews: 240,
    services: [
      { id: 's1_1', name: 'Initial Consultation', duration: '30 min', price: 120, bookingTemplate: 'simple_appointment' },
      { id: 's1_2', name: 'Follow-up Visit', duration: '15 min', price: 80, bookingTemplate: 'simple_appointment' },
      { id: 's1_3', name: 'Acne Treatment', duration: '45 min', price: 150, bookingTemplate: 'simple_appointment' },
    ],
    unavailableDays: [0, 6],
    unavailableDates: ['2026-05-15', '2026-05-20'],
  },
  {
    id: 'p2',
    name: 'Julian Vance',
    role: 'Master Barber',
    rating: 4.8,
    reviews: 180,
    services: [
      { id: 's2_1', name: 'The Signature Cut', duration: '45 min', price: 65, bookingTemplate: 'simple_appointment' },
      { id: 's2_2', name: 'Beard Trim', duration: '20 min', price: 30, bookingTemplate: 'simple_appointment' },
      { id: 's2_3', name: 'Hot Towel Shave', duration: '30 min', price: 45, bookingTemplate: 'simple_appointment' },
    ],
    unavailableDays: [1],
    unavailableDates: [],
  },
  {
    id: 'p3',
    name: 'Sophia Lane',
    role: 'Massage Therapist',
    rating: 5.0,
    reviews: 310,
    services: [
      { id: 's3_1', name: 'Deep Tissue Massage', duration: '60 min', price: 95, bookingTemplate: 'simple_appointment' },
      { id: 's3_2', name: 'Relaxation Massage', duration: '45 min', price: 75, bookingTemplate: 'simple_appointment' },
    ],
    unavailableDays: [0],
    unavailableDates: [],
  },
  {
    id: 'p4',
    name: 'Metro Ride Co.',
    role: 'Private Driver',
    rating: 4.7,
    reviews: 92,
    services: [
      { id: 's4_1', name: 'Standard Ride', duration: 'Varies', price: 35, bookingTemplate: 'ride' },
      { id: 's4_2', name: 'Airport Transfer', duration: '45 min', price: 65, bookingTemplate: 'ride' },
    ],
    unavailableDays: [],
    unavailableDates: [],
  },
  {
    id: 'p5',
    name: 'GreenNest Cleaning',
    role: 'Home Cleaning',
    rating: 4.9,
    reviews: 156,
    services: [
      { id: 's5_1', name: 'Standard Home Clean', duration: '3 hrs', price: 140, bookingTemplate: 'on_site_visit' },
      { id: 's5_2', name: 'Deep Clean', duration: '5 hrs', price: 220, bookingTemplate: 'on_site_visit' },
    ],
    unavailableDays: [0],
    unavailableDates: [],
  },
];

const MOCK_TIMES = ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '01:00 PM', '01:30 PM', '02:00 PM', '03:00 PM', '04:00 PM'];

const formatDateStr = (date: Date) => {
  return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// --- MAIN COMPONENT ---
interface ScheduleScreenProps {
  externalModalVisible?: boolean;
  onExternalModalClose?: () => void;
}

export default function ScheduleScreen(props: ScheduleScreenProps = {}) {
  const { role, hasRole } = useAuth();
  if (hasRole('employee')) {
    return <EmployeeScheduleScreen {...props} />;
  }
  if (role === 'user') {
    return <UserScheduleScreen {...props} />;
  }
  return <ProviderScheduleScreen {...props} />;
}

function ProviderScheduleScreen({ externalModalVisible, onExternalModalClose }: ScheduleScreenProps = {}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const [modalVisible, setModalVisible] = useState(false);
  // Booking State
  const [selectedProviderId, setSelectedProviderId] = useState(MOCK_PROVIDERS[0].id);
  const selectedProvider = useMemo(() => MOCK_PROVIDERS.find(p => p.id === selectedProviderId) || MOCK_PROVIDERS[0], [selectedProviderId]);

  const [selectedServiceId, setSelectedServiceId] = useState(selectedProvider.services[0].id);
  const selectedService = useMemo(() => selectedProvider.services.find(s => s.id === selectedServiceId) || selectedProvider.services[0], [selectedProviderId, selectedServiceId]);

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [bookingDetails, setBookingDetails] = useState<BookingDetails>({});
  const [providerSheetVisible, setProviderSheetVisible] = useState(false);

  const bookingFields = useMemo(
    () => getFieldsForTemplate(selectedService.bookingTemplate),
    [selectedService.bookingTemplate]
  );
  const inputFields = useMemo(() => getInputFields(bookingFields), [bookingFields]);
  const timeFields = useMemo(() => getTimeFields(bookingFields), [bookingFields]);
  const showDatePicker = hasDateField(bookingFields);

  const resetBookingDetails = useCallback(() => {
    setSelectedDate(null);
    setBookingDetails({});
  }, []);

  const setDetail = useCallback((key: BookingFieldKey, value: string) => {
    setBookingDetails((prev) => ({ ...prev, [key]: value }));
  }, []);

  const canConfirm = useMemo(
    () => isBookingComplete(bookingFields, bookingDetails, selectedDate),
    [bookingFields, bookingDetails, selectedDate]
  );

  useEffect(() => {
    if (externalModalVisible) {
      setModalVisible(true);
    }
  }, [externalModalVisible]);

  useEffect(() => {
    setSelectedServiceId(selectedProvider.services[0].id);
    resetBookingDetails();
  }, [selectedProviderId, resetBookingDetails]);

  useEffect(() => {
    resetBookingDetails();
  }, [selectedServiceId, resetBookingDetails]);

  const handleModalClose = () => {
    setModalVisible(false);
    onExternalModalClose?.();
  };

  // --- Calendar Logic ---
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let firstDayIndex = firstDay.getDay(); // 0 for Sun, 6 for Sat
    
    const days = [];
    
    // Prev month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }
    
    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }
    
    // Next month days to fill grid
    const remaining = Math.ceil(days.length / 7) * 7 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }
    
    return days;
  }, [currentMonth]);

  const isDateUnavailable = (date: Date) => {
    if (date < today) return true; // past dates
    
    const dayOfWeek = date.getDay();
    if (selectedProvider.unavailableDays.includes(dayOfWeek)) return true;
    
    const dateStr = formatDateStr(date);
    if (selectedProvider.unavailableDates.includes(dateStr)) return true;
    
    return false;
  };

  const isSameDay = (d1: Date | null, d2: Date | null) => {
    if (!d1 || !d2) return false;
    return d1.getFullYear() === d2.getFullYear() && 
           d1.getMonth() === d2.getMonth() && 
           d1.getDate() === d2.getDate();
  };

  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Schedule</Text>
          <TouchableOpacity>
            <Ionicons name="filter-outline" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
        
        {UPCOMING_MEETINGS.map((meeting) => (
          <Card key={meeting.id} style={styles.meetingCard}>
            <View style={styles.meetingTop}>
              <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.meetingDate}>{meeting.date} • {meeting.time}</Text>
              </View>
              <View style={[styles.badge, meeting.status === 'Confirmed' ? styles.badgeConfirmed : styles.badgePending]}>
                <Text style={[styles.badgeText, meeting.status === 'Confirmed' ? styles.badgeTextConfirmed : styles.badgeTextPending]}>
                  {meeting.status}
                </Text>
              </View>
            </View>
            
            <View style={styles.cardDivider} />
            
            <View style={styles.meetingInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{meeting.provider.split(' ').map(n => n[0]).join('').slice(0, 2)}</Text>
              </View>
              <View style={styles.meetingDetails}>
                <Text style={styles.meetingProvider}>{meeting.provider}</Text>
                <Text style={styles.meetingRole}>{meeting.role}</Text>
                <Text style={styles.meetingService}>{meeting.service}</Text>
              </View>
            </View>
          </Card>
        ))}
        
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Book Appointment Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleModalClose}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Book Appointment</Text>
            <TouchableOpacity onPress={handleModalClose}>
              <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
            
            {/* --- Provider Selection --- */}
            <Text style={styles.modalSectionTitle}>Select Provider</Text>
            <TouchableOpacity style={styles.providerSelectBtn} onPress={() => setProviderSheetVisible(true)}>
              <View style={styles.providerSelectBtnLeft}>
                <View style={styles.pillAvatar}>
                  <Text style={styles.pillAvatarText}>{selectedProvider.name.charAt(0)}</Text>
                </View>
                <Text style={styles.providerSelectBtnText}>{selectedProvider.name}</Text>
              </View>
              <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            {/* --- Service Selection --- */}
            <Text style={styles.modalSectionTitle}>Select Service</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {selectedProvider.services.map((service) => {
                const isSelected = service.id === selectedServiceId;
                return (
                  <TouchableOpacity 
                    key={service.id} 
                    style={[styles.serviceCard, isSelected && styles.serviceCardActive]}
                    onPress={() => setSelectedServiceId(service.id)}
                  >
                    <View style={styles.serviceHeader}>
                      <Text style={[styles.serviceName, isSelected && styles.serviceNameActive]}>{service.name}</Text>
                      {isSelected && <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />}
                    </View>
                    <Text style={styles.serviceDuration}>{service.duration}</Text>
                    <Text style={[styles.servicePrice, isSelected && styles.servicePriceActive]}>${service.price}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* --- Service-specific text / address fields --- */}
            {inputFields.length > 0 && (
              <>
                <Text style={styles.modalSectionTitle}>Service details</Text>
                <ServiceBookingFields
                  fields={inputFields}
                  values={bookingDetails}
                  onChange={setDetail}
                />
              </>
            )}

            {/* --- Date selection (when required for this service) --- */}
            {showDatePicker && (
              <>
                <View style={styles.modalSectionHeader}>
                  <Text style={styles.modalSectionTitle}>
                    {getDateFields(bookingFields)[0]?.label ?? 'Select date'}
                  </Text>
                  <View style={styles.dateNav}>
                    <TouchableOpacity style={styles.navButton} onPress={prevMonth}>
                      <Ionicons name="chevron-back" size={20} color={theme.colors.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.navButton} onPress={nextMonth}>
                      <Ionicons name="chevron-forward" size={20} color={theme.colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <Card style={styles.calendarCard}>
                  <Text style={styles.monthTitle}>
                    {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </Text>
                  <View style={styles.weekDays}>
                    {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map((day) => (
                      <Text key={day} style={styles.weekDayText}>{day}</Text>
                    ))}
                  </View>
                  <View style={styles.daysGrid}>
                    {calendarDays.map((item, idx) => {
                      const unavailable = isDateUnavailable(item.date);
                      const selected = isSameDay(item.date, selectedDate);

                      return (
                        <TouchableOpacity
                          key={idx}
                          style={styles.dayCell}
                          disabled={!item.isCurrentMonth || unavailable}
                          onPress={() => setSelectedDate(item.date)}
                        >
                          <View style={[styles.dayCircle, selected && styles.dayCircleActive]}>
                            <Text
                              style={[
                                styles.dayText,
                                !item.isCurrentMonth && styles.dayTextMuted,
                                unavailable && styles.dayTextUnavailable,
                                selected && styles.dayTextActive,
                              ]}
                            >
                              {item.date.getDate()}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </Card>
              </>
            )}

            {/* --- Time slots (one or more per service type) --- */}
            {timeFields.map((field, fieldIdx) => (
              <BookingTimeSlots
                key={field.key}
                label={field.label}
                required={field.required}
                times={MOCK_TIMES}
                selected={bookingDetails[field.key] ?? null}
                onSelect={(time) => setDetail(field.key, time)}
                disabled={showDatePicker && !selectedDate}
                emptyMessage={`Select a date first to choose ${field.label.toLowerCase()}.`}
                availabilitySeed={
                  selectedDate
                    ? selectedDate.getDate() + fieldIdx + selectedProvider.name.length
                    : fieldIdx
                }
              />
            ))}

            {/* --- Summary Card --- */}
            <View style={styles.summaryContainer}>
              <View style={styles.summaryHeader}>
                <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.summaryTitle}>Summary</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Provider</Text>
                <Text style={styles.summaryValue}>{selectedProvider.name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Service</Text>
                <Text style={styles.summaryValue}>{selectedService.name}</Text>
              </View>
              {bookingFields.map((field) => {
                const value = getDetailValue(
                  field.key,
                  bookingDetails,
                  selectedDate,
                  (d) => formatDateForSummary(d, MONTH_NAMES)
                );
                if (field.type === 'date' && !showDatePicker) return null;
                return (
                  <View key={field.key} style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>{field.label}</Text>
                    <Text style={[styles.summaryValue, styles.summaryValueDetail]} numberOfLines={2}>
                      {value || 'Not provided'}
                    </Text>
                  </View>
                );
              })}
              <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                <Text style={styles.summaryLabel}>Total</Text>
                <Text style={styles.summaryTotalValue}>${selectedService.price.toFixed(2)}</Text>
              </View>
            </View>

            <Button 
              title="Confirm Appointment" 
              onPress={handleModalClose} 
              style={styles.confirmButton}
              disabled={!canConfirm}
            />
            
            <View style={styles.bottomSpacer} />
          </ScrollView>

          {/* Provider Bottom Sheet Overlay */}
          {providerSheetVisible && (
            <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]}>
              <View style={styles.bottomSheetOverlay}>
                <TouchableOpacity style={{flex: 1}} onPress={() => setProviderSheetVisible(false)} />
                <View style={styles.bottomSheetContainer}>
                  <View style={styles.bottomSheetHandle} />
                  <Text style={styles.bottomSheetTitle}>Select Provider</Text>
                  {MOCK_PROVIDERS.map(p => (
                    <TouchableOpacity 
                      key={p.id} 
                      style={styles.bottomSheetItem} 
                      onPress={() => { 
                        setSelectedProviderId(p.id); 
                        setProviderSheetVisible(false); 
                      }}
                    >
                      <View style={styles.bottomSheetItemLeft}>
                        <View style={styles.pillAvatar}>
                          <Text style={styles.pillAvatarText}>{p.name.charAt(0)}</Text>
                        </View>
                        <Text style={[styles.bottomSheetItemText, selectedProviderId === p.id && styles.bottomSheetItemTextActive]}>
                          {p.name}
                        </Text>
                      </View>
                      {selectedProviderId === p.id && <Ionicons name="checkmark" size={20} color={theme.colors.primary} />}
                    </TouchableOpacity>
                  ))}
                  <View style={styles.bottomSpacer} />
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.md,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes.h1,
    color: theme.colors.textPrimary,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.title,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
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
  },
  meetingDate: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textPrimary,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  badgeConfirmed: {
    backgroundColor: theme.colors.success + '20',
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
    color: theme.colors.primary,
  },
  cardDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  meetingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.primary,
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
    color: theme.colors.primary,
  },
  bottomSpacer: {
    height: 110,
  },
  
  // Modal Styles
  modal: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes.title,
    color: theme.colors.textPrimary,
  },
  modalScrollContent: {
    padding: theme.spacing.md,
  },
  modalSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modalSectionTitle: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.title,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  horizontalScroll: {
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  
  // Provider Select Btn
  providerSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  providerSelectBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerSelectBtnText: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
  },
  
  // Provider Pills (kept for reference or other uses)
  providerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: 6,
    paddingRight: 16,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
  },
  providerPillActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  pillAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  pillAvatarText: {
    color: theme.colors.textInverted,
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: 12,
  },
  providerPillText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textPrimary,
  },
  providerPillTextActive: {
    color: theme.colors.primary,
  },

  // Service Cards
  serviceCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: 200,
    marginRight: 12,
  },
  serviceCardActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  serviceName: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  serviceNameActive: {
    color: theme.colors.primary,
  },
  serviceDuration: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  servicePrice: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
  },
  servicePriceActive: {
    color: theme.colors.primary,
  },

  // Date Selection
  dateNav: {
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCard: {
    marginBottom: theme.spacing.lg,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  monthTitle: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    marginLeft: 8,
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.sm,
  },
  weekDayText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: 10,
    color: theme.colors.textSecondary,
    width: 32,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: {
    backgroundColor: theme.colors.primary,
  },
  dayText: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
  },
  dayTextMuted: {
    color: theme.colors.border, // Very faint for previous/next month
  },
  dayTextUnavailable: {
    color: theme.colors.textSecondary,
    textDecorationLine: 'line-through',
    opacity: 0.4,
  },
  dayTextActive: {
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textInverted,
  },
  
  summaryValueDetail: {
    flex: 1,
    textAlign: 'right',
    marginLeft: theme.spacing.md,
  },

  // Summary
  summaryContainer: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  summaryTitle: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.title,
    color: theme.colors.primary,
    marginLeft: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  summaryLabel: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textSecondary,
  },
  summaryValue: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textPrimary,
  },
  summaryTotalRow: {
    marginTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: theme.spacing.sm,
  },
  summaryTotalValue: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.title,
    color: theme.colors.primary,
  },
  confirmButton: {
    marginBottom: theme.spacing.xl,
  },

  // Bottom Sheet
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    paddingBottom: 0,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  bottomSheetTitle: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes.title,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  bottomSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  bottomSheetItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomSheetItemText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
  },
  bottomSheetItemTextActive: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bold,
  },
  });
}