import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import type { BookingDetails, BookingFieldDef } from '../lib/serviceBookingFields';
import { AddressAutocompleteInput } from './AddressAutocompleteInput';

type ServiceBookingFieldsProps = {
  fields: BookingFieldDef[];
  values: BookingDetails;
  onChange: (key: BookingFieldDef['key'], value: string) => void;
};

export function ServiceBookingFields({ fields, values, onChange }: ServiceBookingFieldsProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  if (fields.length === 0) return null;

  return (
    <View style={styles.container}>
      {fields.map((field) => (
        <View key={field.key} style={styles.field}>
          <Text style={styles.label}>
            {field.label}
            {!field.required && <Text style={styles.optional}> (optional)</Text>}
          </Text>
          {field.type === 'address' ? (
            <AddressAutocompleteInput
              value={values[field.key] ?? ''}
              onChange={(text) => onChange(field.key, text)}
              placeholder={field.placeholder ?? 'Start typing street address'}
              requireSelection
            />
          ) : (
            <TextInput
              style={styles.input}
              value={values[field.key] ?? ''}
              onChangeText={(text) => onChange(field.key, text)}
              placeholder={field.placeholder ?? field.label}
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="sentences"
            />
          )}
        </View>
      ))}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  container: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  field: {
    gap: theme.spacing.sm,
  },
  label: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textPrimary,
    marginLeft: 4,
  },
  optional: {
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
  },
  input: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.body,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    color: theme.colors.textPrimary,
  },
  });
}