import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';

type AddActionSheetVariant = 'user' | 'employee';

interface AddActionSheetProps {
  visible: boolean;
  variant: AddActionSheetVariant;
  onClose: () => void;
  onScan: () => void;
  onSearch: () => void;
  onShowQR?: () => void;
}

type SheetOption = {
  key: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
};

export function AddActionSheet({
  visible,
  variant,
  onClose,
  onScan,
  onSearch,
  onShowQR,
}: AddActionSheetProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const isEmployee = variant === 'employee';

  const options: SheetOption[] = isEmployee
    ? [
        {
          key: 'show-qr',
          title: 'Show QR Code',
          description: 'Let clients scan to view your profile',
          icon: 'qr-code',
          color: theme.colors.tertiary,
          onPress: onShowQR!,
        },
        {
          key: 'scan',
          title: 'Scan QR Code',
          description: 'Add a provider by scanning their code',
          icon: 'scan-outline',
          color: theme.colors.secondary,
          onPress: onScan,
        },
        {
          key: 'search',
          title: 'Search for a Service',
          description: 'Find providers by name or service type',
          icon: 'search',
          color: theme.colors.primary,
          onPress: onSearch,
        },
      ]
    : [
        {
          key: 'scan',
          title: 'Scan QR Code',
          description: 'Point your camera at a provider\'s code',
          icon: 'scan-outline',
          color: theme.colors.secondary,
          onPress: onScan,
        },
        {
          key: 'search',
          title: 'Search for a Service',
          description: 'Find providers by name or service type',
          icon: 'search',
          color: theme.colors.primary,
          onPress: onSearch,
        },
      ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{isEmployee ? 'Quick Actions' : 'Add a Favorite'}</Text>
          <Text style={styles.subtitle}>
            {isEmployee
              ? 'Share your profile, scan a code, or search for a service.'
              : 'Scan a provider\'s QR code or search by name.'}
          </Text>

          {options.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={styles.option}
              onPress={option.onPress}
              activeOpacity={0.8}
            >
              <View style={[styles.optionIcon, { backgroundColor: option.color }]}>
                <Ionicons name={option.icon} size={24} color={theme.colors.bubbleSentText} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionDesc}>{option.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    gap: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: 22,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 16,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  optionDesc: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  });
}