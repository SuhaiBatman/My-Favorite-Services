import React from 'react';
import { View, StyleSheet, ViewProps, ViewStyle } from 'react-native';
import type { AppTheme } from '../constants/theme';
import { useThemedStyles } from '../hooks/use-themed-styles';

interface CardProps extends ViewProps {
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined' | 'flat';
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
    },
    elevated: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    outlined: {
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    flat: {},
  });
}

export const Card: React.FC<CardProps> = ({ style, children, variant = 'elevated', ...props }) => {
  const styles = useThemedStyles(createStyles);
  const containerStyle = [
    styles.container,
    variant === 'elevated' && styles.elevated,
    variant === 'outlined' && styles.outlined,
    variant === 'flat' && styles.flat,
    style,
  ];

  return (
    <View style={containerStyle} {...props}>
      {children}
    </View>
  );
};
