import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import { searchBusinesses, type BusinessSuggestion } from '../lib/businessSearch';

type BusinessAutocompleteInputProps = {
  value: string;
  onChangeText: (businessName: string) => void;
  placeholder?: string;
  inputStyle?: StyleProp<TextStyle>;
};

function newSessionToken(): string {
  return Crypto.randomUUID();
}

export function BusinessAutocompleteInput({
  value,
  onChangeText,
  placeholder = 'e.g. Sterling Dermatology',
  inputStyle,
}: BusinessAutocompleteInputProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<BusinessSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusedRef = useRef(false);
  const sessionTokenRef = useRef(newSessionToken());

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (blurDismissRef.current) clearTimeout(blurDismissRef.current);
    };
  }, []);

  const dismissSuggestions = useCallback(() => {
    setIsFocused(false);
    focusedRef.current = false;
  }, []);

  const runSearch = useCallback(async (text: string) => {
    if (text.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const results = await searchBusinesses(text, sessionTokenRef.current);
      setSuggestions(results);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    setQuery(text);
    onChangeText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(text);
    }, 300);
  };

  const handleFocus = () => {
    if (blurDismissRef.current) {
      clearTimeout(blurDismissRef.current);
      blurDismissRef.current = null;
    }
    focusedRef.current = true;
    setIsFocused(true);
  };

  const handleBlur = () => {
    if (blurDismissRef.current) clearTimeout(blurDismissRef.current);
    blurDismissRef.current = setTimeout(() => {
      blurDismissRef.current = null;
      dismissSuggestions();
    }, 150);
  };

  const cancelBlurDismiss = () => {
    if (blurDismissRef.current) {
      clearTimeout(blurDismissRef.current);
      blurDismissRef.current = null;
    }
  };

  const handleSelect = (item: BusinessSuggestion) => {
    sessionTokenRef.current = newSessionToken();
    setQuery(item.name);
    onChangeText(item.name);
    setSuggestions([]);
    dismissSuggestions();
    Keyboard.dismiss();
  };

  const handleClear = () => {
    sessionTokenRef.current = newSessionToken();
    setQuery('');
    onChangeText('');
    setSuggestions([]);
  };

  const showSuggestionList = isFocused && suggestions.length > 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, inputStyle, styles.inputWithClear]}
          value={query}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
        />
        {loading ? (
          <View style={styles.trailingSlot} pointerEvents="none">
            <ActivityIndicator size="small" color={theme.colors.secondary} />
          </View>
        ) : query.length > 0 ? (
          <TouchableOpacity onPress={handleClear} hitSlop={8} style={styles.trailingSlot}>
            <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {showSuggestionList ? (
        <View style={styles.suggestions}>
          {suggestions.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.suggestionRow}
              onPressIn={cancelBlurDismiss}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="business-outline" size={18} color={theme.colors.secondary} />
              <Text style={styles.suggestionText} numberOfLines={2}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrap: {
      gap: theme.spacing.xs,
    },
    inputRow: {
      position: 'relative',
      justifyContent: 'center',
    },
    input: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: 16,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      padding: 16,
      color: theme.colors.textPrimary,
    },
    inputWithClear: {
      paddingRight: 44,
    },
    trailingSlot: {
      position: 'absolute',
      right: 12,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 28,
    },
    suggestions: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
      overflow: 'hidden',
      marginTop: theme.spacing.xs,
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    suggestionText: {
      flex: 1,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.textPrimary,
    },
  });
}
