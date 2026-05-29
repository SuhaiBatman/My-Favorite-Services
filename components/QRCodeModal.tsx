import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';

interface QRCodeModalProps {
  visible: boolean;
  onClose: () => void;
  value: string;
  name: string;
  subtitle?: string;
}

export function QRCodeModal({ visible, onClose, value, name, subtitle }: QRCodeModalProps) {
  const { theme, isDark } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={theme.colors.bubbleSentText} />
          </View>
          <Text style={styles.name}>{name}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          <View style={styles.qrWrap}>
            <QRCode
              value={value}
              size={220}
              color={isDark ? '#0F172A' : theme.colors.textPrimary}
              backgroundColor="#FFFFFF"
            />
          </View>

          <Text style={styles.hint}>
            Clients scan this code to open your profile in the app and add you to their favorites.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: 32,
    padding: 28,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  name: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: 22,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  qrWrap: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginVertical: 24,
  },
  hint: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  });
}