import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import {
  LiquidGlassSurface,
  canUseNativeGlassEffect,
  glassShellStyle,
} from './LiquidGlassSurface';

const ACTION_HEIGHT = 52;
const ACTION_RADIUS = ACTION_HEIGHT / 2;

type FloatingGlassButtonProps = {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  bottomInset?: number;
};

export function floatingGlassButtonReservedHeight(bottomInset?: number): number {
  return 16 + ACTION_HEIGHT + (bottomInset ?? 24);
}

export function FloatingGlassButton({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
  style,
  bottomInset,
}: FloatingGlassButtonProps) {
  const { theme, isDark } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { bottom } = useSafeAreaInsets();
  const useNativeGlass = useMemo(canUseNativeGlassEffect, []);
  const resolvedBottomInset = bottomInset ?? Math.max(bottom, 24);
  const labelColor = theme.colors.secondary;

  return (
    <View
      style={[styles.host, { paddingBottom: resolvedBottomInset }, style]}
      pointerEvents="box-none"
    >
      <View style={[styles.glassBubble, glassShellStyle(theme), { opacity: disabled ? 0.45 : 1 }]}>
        <LiquidGlassSurface
          theme={theme}
          isDark={isDark}
          style={StyleSheet.absoluteFill}
          borderRadius={ACTION_RADIUS}
          interactive={useNativeGlass}
        />
        <TouchableOpacity
          style={styles.buttonTouch}
          onPress={onPress}
          disabled={disabled || loading}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          {loading ? (
            <ActivityIndicator size="small" color={labelColor} />
          ) : (
            <>
              {icon ? <Ionicons name={icon} size={18} color={labelColor} /> : null}
              <Text style={[styles.buttonLabel, { color: labelColor }]}>{label}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    host: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      paddingTop: 16,
      zIndex: 40,
      elevation: 40,
    },
    glassBubble: {
      height: ACTION_HEIGHT,
      borderRadius: ACTION_RADIUS,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    buttonTouch: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      height: ACTION_HEIGHT,
    },
    buttonLabel: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: 16,
      letterSpacing: 0.1,
    },
  });
}
