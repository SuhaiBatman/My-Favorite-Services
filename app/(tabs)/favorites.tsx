import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '../../constants/theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../hooks/use-themed-styles';

export default function FavoritesScreen() {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Favorites</Text>
          <TouchableOpacity>
            <Ionicons name="share-outline" size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={styles.body}>
        <View style={styles.iconContainer}>
          <Ionicons name="star" size={56} color={theme.colors.primaryLight} />
        </View>
        <Text style={styles.title}>No Favorites Yet</Text>
        <Text style={styles.subtitle}>
          Tap the heart icon on any provider card{'\n'}to save them here for quick access.
        </Text>
        <TouchableOpacity style={styles.cta}>
          <Ionicons name="arrow-back" size={16} color={theme.colors.primary} />
          <Text style={styles.ctaText}>Browse Providers</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerSafeArea: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes.h1,
    color: theme.colors.textPrimary,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.background,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.title,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.borderRadius.full,
  },
  ctaText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.primary,
  },
  });
}