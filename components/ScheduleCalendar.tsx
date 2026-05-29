import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import { Card } from './Card';
import type { ScheduleDayMarker } from '../lib/appointmentCalendar';
import { localDateKey } from '../lib/format';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAY_LABELS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const MARKER_BLUE = '#2563EB';
const MARKER_GREEN = '#16A34A';
const MARKER_BLACK = '#111827';

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
};

export type ScheduleCalendarProps = {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  dayMarkers?: Record<string, ScheduleDayMarker>;
  pendingDays?: Set<string>;
  onMonthChange?: (year: number, month: number) => void;
};

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function DayMarkerRing({
  marker,
  pending,
}: {
  marker?: ScheduleDayMarker;
  pending?: boolean;
}) {
  if (!marker && !pending) return null;

  const ringStyle = pending
    ? { borderWidth: 2, borderColor: MARKER_BLACK }
    : { borderWidth: 2, borderColor: 'transparent' };

  if (marker === 'both') {
    return (
      <View style={[stylesMarker.wrap, ringStyle]}>
        <View style={stylesMarker.splitRow}>
          <View style={[stylesMarker.half, { backgroundColor: MARKER_BLUE }]} />
          <View style={[stylesMarker.half, { backgroundColor: MARKER_GREEN }]} />
        </View>
      </View>
    );
  }

  const fill =
    marker === 'provider' ? MARKER_BLUE : marker === 'client' ? MARKER_GREEN : undefined;

  return (
    <View
      style={[
        stylesMarker.wrap,
        ringStyle,
        fill ? { backgroundColor: fill } : null,
      ]}
    />
  );
}

const stylesMarker = StyleSheet.create({
  wrap: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
  },
  splitRow: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    height: '100%',
  },
  half: {
    flex: 1,
    height: '100%',
  },
});

export function ScheduleCalendar({
  selectedDate,
  onSelectDate,
  dayMarkers = {},
  pendingDays,
  onMonthChange,
}: ScheduleCalendarProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const today = useMemo(() => startOfDay(new Date()), []);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const base = selectedDate ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const calendarDays = useMemo((): CalendarDay[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const days: CalendarDay[] = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    for (let i = 1; i <= lastDay; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    const remaining = Math.ceil(days.length / 7) * 7 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  }, [currentMonth]);

  const shiftMonth = (delta: number) => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1);
    setCurrentMonth(next);
    onMonthChange?.(next.getFullYear(), next.getMonth());
  };

  const monthLabel = `${MONTH_NAMES[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  return (
    <Card style={styles.calendarCard} variant="outlined">
      <View style={styles.monthHeader}>
        <Text style={styles.monthTitle}>{monthLabel}</Text>
        <View style={styles.monthNav}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => shiftMonth(-1)}
            accessibilityLabel="Previous month"
          >
            <Ionicons name="chevron-back" size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => shiftMonth(1)}
            accessibilityLabel="Next month"
          >
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: MARKER_BLUE }]} />
          <Text style={styles.legendText}>As provider</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: MARKER_GREEN }]} />
          <Text style={styles.legendText}>As client</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendRing, { borderColor: MARKER_BLACK }]} />
          <Text style={styles.legendText}>Needs response</Text>
        </View>
      </View>

      <View style={styles.weekDays}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekDayText}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.daysGrid}>
        {calendarDays.map((item, idx) => {
          const key = localDateKey(item.date);
          const marker = dayMarkers[key];
          const pending = pendingDays?.has(key);
          const selected = isSameDay(item.date, selectedDate);
          const hasMarker = Boolean(marker || pending);

          return (
            <TouchableOpacity
              key={`${key}-${idx}`}
              style={styles.dayCell}
              disabled={!item.isCurrentMonth}
              onPress={() => onSelectDate(startOfDay(item.date))}
            >
              <View style={styles.dayInner}>
                {hasMarker ? (
                  <DayMarkerRing marker={marker} pending={pending} />
                ) : null}
                <View style={[styles.dayCircle, selected && styles.dayCircleActive]}>
                  <Text
                    style={[
                      styles.dayText,
                      !item.isCurrentMonth && styles.dayTextMuted,
                      selected && styles.dayTextActive,
                      hasMarker && !selected && styles.dayTextOnMarker,
                    ]}
                  >
                    {item.date.getDate()}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Card>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    calendarCard: {
      paddingHorizontal: 8,
      paddingVertical: 12,
    },
    monthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.sm,
      paddingHorizontal: 4,
    },
    monthTitle: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.textPrimary,
    },
    monthNav: {
      flexDirection: 'row',
      gap: 4,
    },
    navButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
      paddingHorizontal: 4,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendRing: {
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
    },
    legendText: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: 10,
      color: theme.colors.textSecondary,
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
    },
    dayCell: {
      width: `${100 / 7}%`,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayInner: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCircleActive: {
      backgroundColor: theme.colors.secondary,
    },
    dayText: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
    },
    dayTextMuted: {
      color: theme.colors.border,
    },
    dayTextActive: {
      fontFamily: theme.typography.fontFamily.semiBold,
      color: theme.colors.textInverted,
    },
    dayTextOnMarker: {
      fontFamily: theme.typography.fontFamily.semiBold,
      color: '#FFFFFF',
    },
  });
}
