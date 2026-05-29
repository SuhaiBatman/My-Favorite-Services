import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import {
  AppTheme,
  darkTheme,
  lightTheme,
} from '../constants/theme';

const STORAGE_KEY = '@app/color-scheme-preference';

export type ColorSchemePreference = 'light' | 'dark' | 'system';
export type ResolvedColorScheme = 'light' | 'dark';

type ThemeContextValue = {
  theme: AppTheme;
  colorScheme: ResolvedColorScheme;
  preference: ColorSchemePreference;
  setPreference: (preference: ColorSchemePreference) => void;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  colorScheme: 'light',
  preference: 'system',
  setPreference: () => {},
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ColorSchemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
    });
  }, []);

  const setPreference = useCallback((next: ColorSchemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const colorScheme: ResolvedColorScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  const value = useMemo(
    () => ({
      theme,
      colorScheme,
      preference,
      setPreference,
      isDark: colorScheme === 'dark',
    }),
    [theme, colorScheme, preference, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
