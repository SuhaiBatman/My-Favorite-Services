import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import type { AppTheme } from '../constants/theme';
import { initialsFromName } from '../lib/format';
import { useThemedStyles } from '../hooks/use-themed-styles';

type ProviderAvatarProps = {
  name: string;
  size?: number;
  style?: ViewStyle;
};

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    avatar: {
      backgroundColor: theme.colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: {
      fontFamily: theme.typography.fontFamily.bold,
      color: theme.colors.primary,
    },
  });
}

export function ProviderAvatar({ name, size = 48, style }: ProviderAvatarProps) {
  const styles = useThemedStyles(createStyles);
  const radius = size / 2;
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: radius },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.32 }]}>{initialsFromName(name)}</Text>
    </View>
  );
}
