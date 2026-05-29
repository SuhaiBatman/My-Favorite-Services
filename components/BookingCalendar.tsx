import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import { Card } from './Card';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAY_LABELS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
};

export type BookingCalendarProps = {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  /** If set, only these weekdays (0=Sun … 6=Sat) are selectable. */
  availableDaysOfWeek?: number[] | null;
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

export function BookingCalendar({
  selectedDate,
  onSelectDate,
  availableDaysOfWeek,
}: BookingCalendarProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const today = useMemo(() => startOfDay(new Date()), []);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const base = selectedDate ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const availableDaySet = useMemo(() => {
    if (!availableDaysOfWeek?.length) return null;
    return new Set(availableDaysOfWeek);
  }, [availableDaysOfWeek]);

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
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

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
    const day = startOfDay(date);
    if (day < today) return true;
    if (availableDaySet && !availableDaySet.has(day.getDay())) return true;
    return false;
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const monthLabel = `${MONTH_NAMES[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  return (
    <Card style={styles.calendarCard} variant="outlined">
      <View style={styles.monthHeader}>
        <Text style={styles.monthTitle}>{monthLabel}</Text>
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.navButton} onPress={prevMonth} accessibilityLabel="Previous month">
            <Ionicons name="chevron-back" size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButton} onPress={nextMonth} accessibilityLabel="Next month">
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
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
          const unavailable = isDateUnavailable(item.date);
          const selected = isSameDay(item.date, selectedDate);

          return (
            <TouchableOpacity
              key={`${item.date.toISOString()}-${idx}`}
              style={styles.dayCell}
              disabled={!item.isCurrentMonth || unavailable}
              onPress={() => onSelectDate(startOfDay(item.date))}
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
    marginBottom: theme.spacing.md,
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
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  dayTextUnavailable: {
    color: theme.colors.textSecondary,
    textDecorationLine: 'line-through',
    opacity: 0.45,
  },
  dayTextActive: {
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textInverted,
  },
  });
}