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
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import { searchJobTitleSuggestions, type JobTitleSuggestion } from '../lib/jobTitleSuggestions';

type JobTitleAutocompleteInputProps = {
  value: string;
  onChangeText: (jobTitle: string) => void;
  placeholder?: string;
  inputStyle?: StyleProp<TextStyle>;
};

export function JobTitleAutocompleteInput({
  value,
  onChangeText,
  placeholder = 'e.g. Senior Stylist',
  inputStyle,
}: JobTitleAutocompleteInputProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<JobTitleSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }, []);

  const runSearch = useCallback(async (text: string) => {
    setLoading(true);
    try {
      const results = await searchJobTitleSuggestions(text, 10);
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
    }, 250);
  };

  const handleFocus = () => {
    if (blurDismissRef.current) {
      clearTimeout(blurDismissRef.current);
      blurDismissRef.current = null;
    }
    setIsFocused(true);
    void runSearch(query);
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

  const handleSelect = (item: JobTitleSuggestion) => {
    setQuery(item.title);
    onChangeText(item.title);
    setSuggestions([]);
    dismissSuggestions();
    Keyboard.dismiss();
  };

  const showSuggestionList = isFocused && suggestions.length > 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, inputStyle, loading ? styles.inputWithTrailing : undefined]}
          value={query}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="done"
        />
        {loading ? (
          <View style={styles.trailingSlot} pointerEvents="none">
            <ActivityIndicator size="small" color={theme.colors.secondary} />
          </View>
        ) : null}
      </View>

      {showSuggestionList ? (
        <View style={styles.suggestions}>
          {suggestions.map((item) => (
            <TouchableOpacity
              key={`${item.title}-${item.usageCount}`}
              style={styles.suggestionRow}
              onPressIn={cancelBlurDismiss}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="briefcase-outline" size={16} color={theme.colors.secondary} />
              <Text style={styles.suggestionText} numberOfLines={1}>
                {item.title}
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
    inputWithTrailing: {
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
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
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
