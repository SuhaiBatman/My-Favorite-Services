import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import {
  resolveAddressSuggestion,
  searchAddresses,
  type AddressSuggestion,
} from '../lib/addressSearch';

type AddressAutocompleteInputProps = {
  value: string;
  onChange: (formattedAddress: string) => void;
  placeholder?: string;
  requireSelection?: boolean;
};

function newSessionToken(): string {
  return Crypto.randomUUID();
}

export function AddressAutocompleteInput({
  value,
  onChange,
  placeholder = 'Address, airport, or place name',
}: AddressAutocompleteInputProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [verified, setVerified] = useState(Boolean(value));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTokenRef = useRef(newSessionToken());

  useEffect(() => {
    setQuery(value);
    setVerified(Boolean(value));
  }, [value]);

  const runSearch = useCallback(async (text: string) => {
    if (text.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const results = await searchAddresses(text, sessionTokenRef.current);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    setQuery(text);
    setVerified(false);
    onChange('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(text);
    }, 280);
  };

  const handleSelect = async (item: AddressSuggestion) => {
    setResolving(true);
    setShowSuggestions(false);
    try {
      const formatted = await resolveAddressSuggestion(item, sessionTokenRef.current);
      sessionTokenRef.current = newSessionToken();
      setQuery(formatted);
      setVerified(true);
      onChange(formatted);
      setSuggestions([]);
      Keyboard.dismiss();
    } finally {
      setResolving(false);
    }
  };

  const handleClear = () => {
    sessionTokenRef.current = newSessionToken();
    setQuery('');
    setVerified(false);
    onChange('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const busy = loading || resolving;

  return (
    <View style={styles.wrap}>
      <View style={[styles.inputRow, verified && styles.inputRowVerified]}>
        <Ionicons name="search-outline" size={18} color={theme.colors.textSecondary} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleChangeText}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
          editable={!resolving}
        />
        {busy ? (
          <ActivityIndicator size="small" color={theme.colors.secondary} />
        ) : query.length > 0 ? (
          <TouchableOpacity onPress={handleClear} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {showSuggestions && suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          {suggestions.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.suggestionRow}
              onPress={() => void handleSelect(item)}
              activeOpacity={0.7}
              disabled={resolving}
            >
              <Ionicons name="location-outline" size={16} color={theme.colors.secondary} />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
  },
  inputRowVerified: {
    borderColor: theme.colors.success,
  },
  input: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
    padding: 0,
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