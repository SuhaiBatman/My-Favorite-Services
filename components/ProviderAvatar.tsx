import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import type { AppTheme } from '../constants/theme';
import { initialsFromName } from '../lib/format';
import { useThemedStyles } from '../hooks/use-themed-styles';
import { useAppTheme } from '../contexts/ThemeContext';

type ProviderAvatarProps = {
  name: string;
  size?: number;
  style?: ViewStyle;
};

const AVATAR_PALETTE_LIGHT = [
  { bg: '#DBEAFE', text: '#2563EB' },
  { bg: '#D1FAE5', text: '#059669' },
  { bg: '#FCE7F3', text: '#DB2777' },
  { bg: '#FFEDD5', text: '#EA580C' },
  { bg: '#CFFAFE', text: '#0891B2' },
  { bg: '#FEF3C7', text: '#D97706' },
  { bg: '#E0F2FE', text: '#0284C7' },
  { bg: '#CCFBF1', text: '#0D9488' },
];

const AVATAR_PALETTE_DARK = [
  { bg: '#1E3A5F', text: '#BFDBFE' },
  { bg: '#134E4A', text: '#99F6E4' },
  { bg: '#500724', text: '#FBCFE8' },
  { bg: '#431407', text: '#FED7AA' },
  { bg: '#164E63', text: '#A5F3FC' },
  { bg: '#451A03', text: '#FDE68A' },
  { bg: '#0C4A6E', text: '#BAE6FD' },
  { bg: '#134E4A', text: '#5EEAD4' },
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    avatar: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.surface,
    },
    text: {
      fontFamily: theme.typography.fontFamily.bold,
    },
  });
}

export function ProviderAvatar({ name, size = 48, style }: ProviderAvatarProps) {
  const { isDark } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const radius = size / 2;

  const colors = useMemo(() => {
    const palette = isDark ? AVATAR_PALETTE_DARK : AVATAR_PALETTE_LIGHT;
    return palette[hashName(name) % palette.length];
  }, [isDark, name]);

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: colors.bg,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.32, color: colors.text }]}>
        {initialsFromName(name)}
      </Text>
    </View>
  );
}
