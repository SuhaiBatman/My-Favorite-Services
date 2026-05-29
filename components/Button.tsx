import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'destructiveFilled';
  style?: ViewStyle;
  textStyle?: TextStyle;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
      gap: theme.spacing.sm,
    },
    primaryContainer: {
      backgroundColor: theme.colors.secondary,
    },
    outlineContainer: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    destructiveContainer: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.destructive,
    },
    destructiveFilledContainer: {
      backgroundColor: theme.colors.destructive,
      borderWidth: 1,
      borderColor: theme.colors.destructive,
    },
    disabledContainer: {
      opacity: 0.6,
    },
    text: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.body,
    },
    primaryText: {
      color: theme.colors.textInverted,
    },
    outlineText: {
      color: theme.colors.textPrimary,
    },
    destructiveText: {
      color: theme.colors.destructive,
    },
    destructiveFilledText: {
      color: theme.colors.textInverted,
    },
    disabledText: {
      color: theme.colors.textSecondary,
    },
  });
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  style,
  textStyle,
  loading = false,
  disabled = false,
  icon,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';
  const isDestructive = variant === 'destructive';
  const isDestructiveFilled = variant === 'destructiveFilled';

  const containerStyle = [
    styles.container,
    isPrimary && styles.primaryContainer,
    isOutline && styles.outlineContainer,
    isDestructive && styles.destructiveContainer,
    isDestructiveFilled && styles.destructiveFilledContainer,
    disabled && styles.disabledContainer,
    style,
  ];

  const labelStyle = [
    styles.text,
    isPrimary && styles.primaryText,
    isOutline && styles.outlineText,
    isDestructive && styles.destructiveText,
    isDestructiveFilled && styles.destructiveFilledText,
    disabled && styles.disabledText,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={
            isPrimary || isDestructiveFilled
              ? theme.colors.textInverted
              : isDestructive
                ? theme.colors.destructive
                : theme.colors.primary
          }
        />
      ) : (
        <>
          {icon && icon}
          <Text style={labelStyle}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};
