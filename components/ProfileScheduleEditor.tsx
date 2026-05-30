import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '../constants/theme';
import { useThemedStyles } from '../hooks/use-themed-styles';
import {
  SCHEDULE_DAYS,
  SCHEDULE_DAYS_SHORT,
  type DayTiming,
} from '../lib/profileSchedule';

const PICKER_ITEM_HEIGHT = 50;
const HOURS_WHEEL = ['', '', ...Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')), '', ''];
const MINUTES_WHEEL = ['', '', ...Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')), '', ''];
const AMPM_WHEEL = ['', '', 'AM', 'PM', '', ''];

type ProfileScheduleEditorProps = {
  selectedDays: string[];
  dayTimings: Record<string, DayTiming>;
  flexibleHours: boolean;
  onFlexibleHoursChange: (value: boolean) => void;
  onChange: (selectedDays: string[], dayTimings: Record<string, DayTiming>) => void;
};

export function ProfileScheduleEditor({
  selectedDays,
  dayTimings,
  flexibleHours,
  onFlexibleHoursChange,
  onChange,
}: ProfileScheduleEditorProps) {
  const styles = useThemedStyles(createStyles);

  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [activeTimeType, setActiveTimeType] = useState<'start' | 'end' | null>(null);
  const [tempTime, setTempTime] = useState({ hour: '09', minute: '00', ampm: 'AM' });

  const toggleDay = (day: string) => {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day];
    const sorted = next.sort((a, b) => SCHEDULE_DAYS.indexOf(a as (typeof SCHEDULE_DAYS)[number]) - SCHEDULE_DAYS.indexOf(b as (typeof SCHEDULE_DAYS)[number]));
    onChange(sorted, dayTimings);
  };

  const openTimePicker = (day: string, type: 'start' | 'end') => {
    setActiveDay(day);
    setActiveTimeType(type);
    const currentTime = dayTimings[day]?.[type] || (type === 'start' ? '09:00 AM' : '05:00 PM');
    const [time, ampm] = currentTime.split(' ');
    const [hour, minute] = time.split(':');
    setTempTime({ hour, minute, ampm });
    setTimePickerVisible(true);
  };

  const closeTimePicker = () => {
    if (activeDay && activeTimeType) {
      const timeStr = `${tempTime.hour}:${tempTime.minute} ${tempTime.ampm}`;
      onChange(selectedDays, {
        ...dayTimings,
        [activeDay]: {
          ...(dayTimings[activeDay] || { start: '09:00 AM', end: '05:00 PM' }),
          [activeTimeType]: timeStr,
        },
      });
    }
    setTimePickerVisible(false);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>What days do you work?</Text>
      <View style={styles.daySelectorGrid}>
        {SCHEDULE_DAYS.map((day, idx) => {
          const isSelected = selectedDays.includes(day);
          return (
            <TouchableOpacity
              key={day}
              style={[styles.dayCircle, isSelected && styles.dayCircleActive]}
              onPress={() => toggleDay(day)}
            >
              <Text style={[styles.dayCircleText, isSelected && styles.dayCircleTextActive]}>
                {SCHEDULE_DAYS_SHORT[idx]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedDays.length > 0 ? (
        <View style={styles.perDaySection}>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Hours per day</Text>
          {selectedDays.map((day) => (
            <View key={day} style={styles.dayTimingRow}>
              <Text style={styles.dayTimingLabel}>{day}</Text>
              <View style={styles.timeRow}>
                <TouchableOpacity style={styles.timeSelectBtn} onPress={() => openTimePicker(day, 'start')}>
                  <Text style={styles.timeSelectText}>{dayTimings[day]?.start || '09:00 AM'}</Text>
                </TouchableOpacity>
                <Text style={styles.timeSeparatorText}>to</Text>
                <TouchableOpacity style={styles.timeSelectBtn} onPress={() => openTimePicker(day, 'end')}>
                  <Text style={styles.timeSelectText}>{dayTimings[day]?.end || '05:00 PM'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.hint}>Select at least one day to set your availability.</Text>
      )}

      <View style={styles.divider} />
      <TouchableOpacity
        style={[styles.flexibleCard, flexibleHours && styles.flexibleCardActive]}
        onPress={() => onFlexibleHoursChange(!flexibleHours)}
        activeOpacity={0.7}
      >
        <View style={styles.flexibleTextWrap}>
          <Text style={styles.flexibleTitle}>Flexible hours</Text>
          <Text style={styles.flexibleDesc}>
            Let clients know your listed times may vary from week to week.
          </Text>
        </View>
        <View style={[styles.toggleCircle, styles.toggleOptionCheck, flexibleHours && styles.toggleCircleActive]}>
          {flexibleHours ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
        </View>
      </TouchableOpacity>

      <TimePickerModal
        visible={timePickerVisible}
        activeDay={activeDay}
        activeTimeType={activeTimeType}
        tempTime={tempTime}
        setTempTime={setTempTime}
        onClose={closeTimePicker}
      />
    </View>
  );
}

function TimePickerModal({
  visible,
  activeDay,
  activeTimeType,
  tempTime,
  setTempTime,
  onClose,
}: {
  visible: boolean;
  activeDay: string | null;
  activeTimeType: 'start' | 'end' | null;
  tempTime: { hour: string; minute: string; ampm: string };
  setTempTime: React.Dispatch<React.SetStateAction<{ hour: string; minute: string; ampm: string }>>;
  onClose: () => void;
}) {
  const styles = useThemedStyles(createStyles);

  const onScrollHour = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / PICKER_ITEM_HEIGHT);
    const val = HOURS_WHEEL[index + 2];
    if (val && val !== tempTime.hour && val !== '') {
      setTempTime((prev) => ({ ...prev, hour: val }));
    }
  };
  const onScrollMinute = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / PICKER_ITEM_HEIGHT);
    const val = MINUTES_WHEEL[index + 2];
    if (val && val !== tempTime.minute && val !== '') {
      setTempTime((prev) => ({ ...prev, minute: val }));
    }
  };
  const onScrollAMPM = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / PICKER_ITEM_HEIGHT);
    const val = AMPM_WHEEL[index + 2];
    if (val && val !== tempTime.ampm && val !== '') {
      setTempTime((prev) => ({ ...prev, ampm: val }));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.pickerOverlay}>
        <TouchableOpacity activeOpacity={1} style={styles.pickerBackdrop} onPress={onClose} />
        <View style={[styles.pickerContent, { height: 420 }]}>
          <View style={styles.pickerHandle} />
          <View style={styles.pickerHeader}>
            <View>
              <Text style={styles.pickerTitle}>{activeTimeType === 'start' ? 'Start' : 'End'} time</Text>
              <Text style={styles.pickerSubtitle}>{activeDay}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.wheelsContainer}>
            <View style={styles.wheelIndicator} />
            <View style={styles.wheelColumn}>
              <FlatList
                data={HOURS_WHEEL}
                keyExtractor={(_, i) => `h-${i}`}
                showsVerticalScrollIndicator={false}
                snapToInterval={PICKER_ITEM_HEIGHT}
                onScroll={onScrollHour}
                scrollEventThrottle={16}
                decelerationRate="fast"
                renderItem={({ item }) => (
                  <View style={[styles.wheelItem, { height: PICKER_ITEM_HEIGHT }]}>
                    <Text style={[styles.wheelItemText, tempTime.hour === item && styles.wheelItemTextSelected]}>
                      {item}
                    </Text>
                  </View>
                )}
                initialScrollIndex={Math.max(0, HOURS_WHEEL.indexOf(tempTime.hour) - 2)}
                getItemLayout={(_, index) => ({
                  length: PICKER_ITEM_HEIGHT,
                  offset: PICKER_ITEM_HEIGHT * index,
                  index,
                })}
              />
            </View>
            <Text style={styles.wheelSeparator}>:</Text>
            <View style={styles.wheelColumn}>
              <FlatList
                data={MINUTES_WHEEL}
                keyExtractor={(_, i) => `m-${i}`}
                showsVerticalScrollIndicator={false}
                snapToInterval={PICKER_ITEM_HEIGHT}
                onScroll={onScrollMinute}
                scrollEventThrottle={16}
                decelerationRate="fast"
                renderItem={({ item }) => (
                  <View style={[styles.wheelItem, { height: PICKER_ITEM_HEIGHT }]}>
                    <Text style={[styles.wheelItemText, tempTime.minute === item && styles.wheelItemTextSelected]}>
                      {item}
                    </Text>
                  </View>
                )}
                initialScrollIndex={Math.max(0, MINUTES_WHEEL.indexOf(tempTime.minute) - 2)}
                getItemLayout={(_, index) => ({
                  length: PICKER_ITEM_HEIGHT,
                  offset: PICKER_ITEM_HEIGHT * index,
                  index,
                })}
              />
            </View>
            <View style={[styles.wheelColumn, { flex: 0.6 }]}>
              <FlatList
                data={AMPM_WHEEL}
                keyExtractor={(_, i) => `a-${i}`}
                showsVerticalScrollIndicator={false}
                snapToInterval={PICKER_ITEM_HEIGHT}
                onScroll={onScrollAMPM}
                scrollEventThrottle={16}
                decelerationRate="fast"
                renderItem={({ item }) => (
                  <View style={[styles.wheelItem, { height: PICKER_ITEM_HEIGHT }]}>
                    <Text style={[styles.wheelItemText, tempTime.ampm === item && styles.wheelItemTextSelected]}>
                      {item}
                    </Text>
                  </View>
                )}
                initialScrollIndex={Math.max(0, AMPM_WHEEL.indexOf(tempTime.ampm) - 2)}
                getItemLayout={(_, index) => ({
                  length: PICKER_ITEM_HEIGHT,
                  offset: PICKER_ITEM_HEIGHT * index,
                  index,
                })}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    sectionLabel: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
      marginBottom: 8,
    },
    daySelectorGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    dayCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    dayCircleActive: {
      backgroundColor: theme.colors.secondary,
      borderColor: theme.colors.secondary,
    },
    dayCircleText: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    dayCircleTextActive: {
      color: '#fff',
      fontFamily: theme.typography.fontFamily.bold,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing.md,
    },
    perDaySection: { marginTop: 4 },
    dayTimingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    dayTimingLabel: {
      flex: 0.85,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 14,
      color: theme.colors.textPrimary,
    },
    timeRow: {
      flex: 1.15,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    timeSelectBtn: {
      flex: 1,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingVertical: 10,
      paddingHorizontal: 4,
      alignItems: 'center',
    },
    timeSelectText: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 13,
      color: theme.colors.textPrimary,
    },
    timeSeparatorText: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    hint: {
      marginTop: theme.spacing.sm,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
    },
    flexibleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
    flexibleCardActive: {
      borderColor: theme.colors.secondary,
      backgroundColor: theme.colors.primaryLight,
    },
    flexibleTextWrap: {
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      paddingRight: theme.spacing.xs,
    },
    flexibleTitle: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.textPrimary,
      marginBottom: 2,
    },
    flexibleDesc: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
    },
    toggleOptionCheck: {
      flexShrink: 0,
    },
    toggleCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: theme.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    toggleCircleActive: {
      backgroundColor: theme.colors.secondary,
      borderColor: theme.colors.secondary,
    },
    pickerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    pickerBackdrop: { ...StyleSheet.absoluteFillObject },
    pickerContent: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      padding: 24,
      paddingTop: 12,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    pickerHandle: {
      width: 40,
      height: 4,
      backgroundColor: theme.colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 20,
    },
    pickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    pickerTitle: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 20,
      color: theme.colors.textPrimary,
    },
    pickerSubtitle: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    doneBtn: {
      backgroundColor: theme.colors.secondary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.md,
    },
    doneBtnText: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 14,
      color: '#fff',
    },
    wheelsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 220,
      position: 'relative',
    },
    wheelIndicator: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: '50%',
      height: PICKER_ITEM_HEIGHT,
      marginTop: -PICKER_ITEM_HEIGHT / 2,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      borderRadius: 8,
      zIndex: 0,
    },
    wheelColumn: { flex: 1, height: 220, zIndex: 1 },
    wheelItem: { justifyContent: 'center', alignItems: 'center' },
    wheelItemText: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 20,
      color: theme.colors.textSecondary,
    },
    wheelItemTextSelected: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 24,
      color: theme.colors.secondary,
    },
    wheelSeparator: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 24,
      color: theme.colors.textPrimary,
      marginHorizontal: 4,
      zIndex: 1,
    },
  });
}
