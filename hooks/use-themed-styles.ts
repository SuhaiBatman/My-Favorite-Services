import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';

export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: AppTheme) => T
): T {
  const { theme } = useAppTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [theme, factory]);
}
