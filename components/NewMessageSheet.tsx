import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import { useFullScreenSheetTopInset } from '../hooks/use-full-screen-sheet-top-inset';
import { ProviderAvatar } from './ProviderAvatar';
import { listMessageableProviders, type ProviderListItem } from '../lib/messaging';
import { profileDisplayName } from '../lib/format';
import { useFavorites } from '../contexts/FavoritesContext';

type NewMessageSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSelectProvider: (providerId: string) => void;
  title?: string;
  searchPlaceholder?: string;
  /** Hide providers already saved to the user's favorites list. */
  excludeFavorites?: boolean;
};

export function NewMessageSheet({
  visible,
  onClose,
  onSelectProvider,
  title = 'New message',
  searchPlaceholder = 'Search providers...',
  excludeFavorites = false,
}: NewMessageSheetProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const topInset = useFullScreenSheetTopInset();
  const { isFavorite } = useFavorites();

  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await listMessageableProviders();
        if (!cancelled) setProviders(list);
      } catch {
        if (!cancelled) setProviders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) setSearch('');
  }, [visible]);

  const filtered = useMemo(() => {
    let list = excludeFavorites
      ? providers.filter((p) => !isFavorite(p.id))
      : providers;
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const name = profileDisplayName(p.first_name, p.last_name).toLowerCase();
      const title = (p.job_title || p.business_name || '').toLowerCase();
      return name.includes(q) || title.includes(q);
    });
  }, [providers, search, excludeFavorites, isFavorite]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: topInset }]}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={theme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={searchPlaceholder}
            placeholderTextColor={theme.colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loader} color={theme.colors.secondary} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={40} color={theme.colors.border} />
                <Text style={styles.emptyTitle}>No providers found</Text>
                <Text style={styles.emptySubtitle}>
                  Providers appear here once they join as employees.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const name = profileDisplayName(item.first_name, item.last_name);
              const subtitle = item.job_title || item.business_name || 'Service Provider';
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => onSelectProvider(item.id)}
                >
                  <ProviderAvatar name={name} size={44} />
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{name}</Text>
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes.title,
    color: theme.colors.textPrimary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
  },
  loader: {
    marginTop: 40,
  },
  list: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
  },
  rowSubtitle: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 48,
    gap: theme.spacing.sm,
  },
  emptyTitle: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
  },
  emptySubtitle: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  });
}