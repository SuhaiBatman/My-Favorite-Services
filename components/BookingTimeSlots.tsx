import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { AppTheme } from '../constants/theme';
import { useThemedStyles } from '../hooks/use-themed-styles';

type BookingTimeSlotsProps = {
  label: string;
  required?: boolean;
  times: string[];
  selected: string | null;
  onSelect: (time: string) => void;
  disabled?: boolean;
  emptyMessage?: string;
  /** Seed for mock availability — varies slots per day/provider */
  availabilitySeed?: number;
};

export function BookingTimeSlots({
  label,
  required = true,
  times,
  selected,
  onSelect,
  disabled = false,
  emptyMessage = 'Please select a date to view availability.',
  availabilitySeed = 0,
}: BookingTimeSlotsProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.sectionTitle}>
        {label}
        {!required && <Text style={styles.optional}> (optional)</Text>}
      </Text>
      {disabled ? (
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      ) : (
        <View style={styles.timeGrid}>
          {times.map((time, idx) => {
            const isUnavailable = (availabilitySeed + idx) % 4 === 0;
            const isSelected = selected === time;

            return (
              <TouchableOpacity
                key={time}
                style={[
                  styles.timePill,
                  isSelected && styles.timePillActive,
                  isUnavailable && styles.timePillDisabled,
                ]}
                disabled={isUnavailable}
                onPress={() => onSelect(time)}
              >
                <Text
                  style={[
                    styles.timeText,
                    isSelected && styles.timeTextActive,
                    isUnavailable && styles.timeTextDisabled,
                  ]}
                >
                  {time}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  wrapper: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.title,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  optional: {
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
  },
  emptyText: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: theme.spacing.sm,
  },
  timePill: {
    width: '30%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timePillActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  timePillDisabled: {
    backgroundColor: theme.colors.messageReceived,
    borderColor: theme.colors.border,
  },
  timeText: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textPrimary,
  },
  timeTextActive: {
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.primary,
  },
  timeTextDisabled: {
    color: theme.colors.textSecondary,
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  });
}