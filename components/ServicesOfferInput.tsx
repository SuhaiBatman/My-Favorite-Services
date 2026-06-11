import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  Modal,
  Alert,
  Pressable,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import { searchServiceSuggestions, type ServiceSuggestion } from '../lib/serviceSuggestions';
import {
  formatServiceDuration,
  formatServicePrice,
  parseDollarInput,
  parseDurationInput,
  type ServiceOffer,
} from '../lib/serviceOffer';

type ServicesOfferInputProps = {
  services: ServiceOffer[];
  onChangeServices: (services: ServiceOffer[]) => void;
  inputStyle?: StyleProp<TextStyle>;
  placeholder?: string;
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function ServicesOfferInput({
  services,
  onChangeServices,
  inputStyle,
  placeholder = 'e.g. Haircut, Coloring...',
}: ServicesOfferInputProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ServiceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [durationInput, setDurationInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addedKeys = useRef(new Set(services.map((service) => normalizeKey(service.name))));
  useEffect(() => {
    addedKeys.current = new Set(services.map((service) => normalizeKey(service.name)));
  }, [services]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (blurDismissRef.current) clearTimeout(blurDismissRef.current);
    };
  }, []);

  const dismissSuggestions = useCallback(() => {
    setIsFocused(false);
  }, []);

  const filterSuggestions = useCallback(
    (items: ServiceSuggestion[]) =>
      items.filter((item) => !addedKeys.current.has(normalizeKey(item.name))),
    []
  );

  const resetPendingService = () => {
    setPendingName(null);
    setDurationInput('');
    setPriceInput('');
  };

  const beginAddService = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || addedKeys.current.has(normalizeKey(trimmed))) return;
    setPendingName(trimmed);
    setDurationInput('');
    setPriceInput('');
    dismissSuggestions();
  };

  const confirmAddService = () => {
    if (!pendingName) return;

    const durationMinutes = parseDurationInput(durationInput);
    const priceCents = parseDollarInput(priceInput);

    if (durationMinutes === null) {
      Alert.alert('Time estimate required', 'Enter how long this service takes in minutes.');
      return;
    }
    if (priceCents === null) {
      Alert.alert('Cost required', 'Enter the price for this service.');
      return;
    }

    onChangeServices([
      ...services,
      { name: pendingName, durationMinutes, priceCents },
    ]);
    setQuery('');
    setSuggestions([]);
    resetPendingService();
    Keyboard.dismiss();
  };

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(text);
    }, 250);
  };

  const runSearch = useCallback(
    async (text: string) => {
      setLoading(true);
      try {
        const results = await searchServiceSuggestions(text, 10);
        setSuggestions(filterSuggestions(results));
      } finally {
        setLoading(false);
      }
    },
    [filterSuggestions]
  );

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

  const handleAddPress = () => {
    beginAddService(query);
    Keyboard.dismiss();
  };

  const handleSelectSuggestion = (item: ServiceSuggestion) => {
    cancelBlurDismiss();
    beginAddService(item.name);
    setQuery('');
    Keyboard.dismiss();
  };

  const removeService = (service: ServiceOffer) => {
    onChangeServices(services.filter((entry) => entry.name !== service.name));
  };

  const showSuggestionList = isFocused && suggestions.length > 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.tagInputRow}>
        <View style={styles.inputWrap}>
          <TextInput
            style={[styles.input, inputStyle, styles.inputFlex]}
            placeholder={placeholder}
            placeholderTextColor="#94A3B8"
            value={query}
            onChangeText={handleChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onSubmitEditing={handleAddPress}
            returnKeyType="done"
            autoCorrect={false}
          />
          {loading ? (
            <View style={styles.trailingSlot} pointerEvents="none">
              <ActivityIndicator size="small" color={theme.colors.secondary} />
            </View>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.addTagBtn}
          onPress={handleAddPress}
          activeOpacity={0.85}
          accessibilityLabel="Add service"
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {showSuggestionList ? (
        <View style={styles.suggestions}>
          {suggestions.map((item) => (
            <TouchableOpacity
              key={`${item.name}-${item.usageCount}`}
              style={styles.suggestionRow}
              onPressIn={cancelBlurDismiss}
              onPress={() => handleSelectSuggestion(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="pricetag-outline" size={16} color={theme.colors.secondary} />
              <Text style={styles.suggestionText} numberOfLines={1}>
                {item.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {services.length > 0 ? (
        <View style={styles.tagChipsRow}>
          {services.map((service) => (
            <View key={service.name} style={styles.tagChip}>
              <View style={styles.tagChipContent}>
                <Text style={styles.tagChipText}>{service.name}</Text>
                {service.durationMinutes > 0 || service.priceCents > 0 ? (
                  <Text style={styles.tagChipMeta}>
                    {[formatServiceDuration(service.durationMinutes), formatServicePrice(service.priceCents)]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => removeService(service)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={theme.colors.secondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      <Modal
        visible={pendingName !== null}
        transparent
        animationType="fade"
        onRequestClose={resetPendingService}
      >
        <Pressable style={styles.modalBackdrop} onPress={resetPendingService}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Service details</Text>
            <Text style={styles.modalSubtitle}>
              Add a time estimate and cost for {pendingName ?? 'this service'}.
            </Text>

            <Text style={styles.modalLabel}>Time estimate (minutes)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 45"
              placeholderTextColor="#94A3B8"
              value={durationInput}
              onChangeText={setDurationInput}
              keyboardType="number-pad"
              returnKeyType="next"
            />

            <Text style={styles.modalLabel}>Cost</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 65"
              placeholderTextColor="#94A3B8"
              value={priceInput}
              onChangeText={setPriceInput}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={confirmAddService}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondaryBtn} onPress={resetPendingService}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={confirmAddService}>
                <Text style={styles.modalPrimaryText}>Add service</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrap: {
      gap: theme.spacing.xs,
    },
    tagInputRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 8,
    },
    inputWrap: {
      flex: 1,
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
    inputFlex: {
      flex: 1,
    },
    trailingSlot: {
      position: 'absolute',
      right: 12,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    addTagBtn: {
      width: 54,
      alignSelf: 'stretch',
      minHeight: 54,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.secondary,
      justifyContent: 'center',
      alignItems: 'center',
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
    tagChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    tagChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: theme.colors.primaryLight,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      maxWidth: '100%',
    },
    tagChipContent: {
      flexShrink: 1,
    },
    tagChipText: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 14,
      color: theme.colors.secondary,
    },
    tagChipMeta: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
      justifyContent: 'center',
      padding: theme.spacing.lg,
    },
    modalCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalTitle: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.sizes.title,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    modalSubtitle: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.md,
    },
    modalLabel: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
      marginBottom: 6,
    },
    modalInput: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 12,
      marginBottom: theme.spacing.md,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    modalSecondaryBtn: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 12,
    },
    modalSecondaryText: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textSecondary,
    },
    modalPrimaryBtn: {
      backgroundColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: 12,
    },
    modalPrimaryText: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.sizes.body,
      color: '#FFFFFF',
    },
  });
}
