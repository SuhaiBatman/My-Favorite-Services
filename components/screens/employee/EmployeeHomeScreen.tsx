import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { AppTheme } from '../../../constants/theme';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { useThemedStyles } from '../../../hooks/use-themed-styles';
import { Card } from '../../Card';
import { ProviderAvatar } from '../../ProviderAvatar';
import { useAuth } from '../../../contexts/AuthContext';
import type { Appointment } from '../../../lib/appointments';
import { loadEmployeeHomeData } from '../../../lib/homeLoad';
import { NewMessageSheet } from '../../NewMessageSheet';
import {
  formatAppointmentTime,
  isAppointmentOnLocalDay,
  profileDisplayName,
} from '../../../lib/format';
import { useFavorites } from '../../../contexts/FavoritesContext';
import { peekHomePrefetch } from '../../../lib/homePrefetch';

const HOME_UPCOMING_PREVIEW_LIMIT = 3;

interface EmployeeHomeScreenProps {
  externalModalVisible?: boolean;
  onExternalModalClose?: () => void;
}

function TodaySection({
  title,
  accentColor,
  appointments,
  emptyText,
  onPressRow,
  renderSubtitle,
}: {
  title: string;
  accentColor: string;
  appointments: Appointment[];
  emptyText: string;
  onPressRow: () => void;
  renderSubtitle: (appt: Appointment) => string;
}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const today = useMemo(
    () => appointments.filter((a) => isAppointmentOnLocalDay(a.starts_at)),
    [appointments]
  );
  const preview = today.slice(0, HOME_UPCOMING_PREVIEW_LIMIT);
  const hasMore = today.length > HOME_UPCOMING_PREVIEW_LIMIT;

  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeaderRow}>
        <View style={[styles.sectionAccent, { backgroundColor: accentColor }]} />
        <Text style={styles.sectionTitleInline}>{title}</Text>
        {today.length > 0 ? (
          <TouchableOpacity style={styles.seeAllBtn} onPress={onPressRow}>
            <Text style={styles.seeAllText}>Schedule</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.secondary} />
          </TouchableOpacity>
        ) : null}
      </View>
      {today.length === 0 ? (
        <Pressable onPress={onPressRow}>
          <View style={styles.upcomingEmpty}>
            <Ionicons name="calendar-outline" size={18} color={theme.colors.textSecondary} />
            <Text style={styles.upcomingEmptyText}>{emptyText}</Text>
          </View>
        </Pressable>
      ) : (
        <Card style={styles.upcomingCompactCard} variant="outlined">
          {preview.map((appt, index) => {
            const isLast = index === preview.length - 1 && !hasMore;
            const name = renderSubtitle(appt);
            return (
              <Pressable
                key={appt.id}
                style={[styles.upcomingRow, !isLast && styles.upcomingRowBorder]}
                onPress={onPressRow}
              >
                <ProviderAvatar name={name} size={28} />
                <View style={styles.upcomingRowText}>
                  <Text style={styles.upcomingRowPrimary} numberOfLines={1}>
                    {`${formatAppointmentTime(appt.starts_at)} · ${name}`}
                  </Text>
                  <Text style={styles.upcomingRowSecondary} numberOfLines={1}>
                    {appt.service_name}
                    {appt.status === 'pending' ? ' · Pending' : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.border} />
              </Pressable>
            );
          })}
          {hasMore ? (
            <Pressable style={[styles.upcomingRow, styles.upcomingMoreRow]} onPress={onPressRow}>
              <Text style={styles.upcomingMoreText}>
                +{today.length - HOME_UPCOMING_PREVIEW_LIMIT} more today on Schedule
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.secondary} />
            </Pressable>
          ) : null}
        </Card>
      )}
    </View>
  );
}

export default function EmployeeHomeScreen({
  externalModalVisible,
  onExternalModalClose,
}: EmployeeHomeScreenProps = {}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const { user, session } = useAuth();
  const userId = user?.id ?? session?.user?.id ?? null;
  const { favorites, refresh: refreshFavorites } = useFavorites();
  const router = useRouter();
  const [asProvider, setAsProvider] = useState<Appointment[]>([]);
  const [asClient, setAsClient] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [providerSearchVisible, setProviderSearchVisible] = useState(false);
  const [favoritesExpanded, setFavoritesExpanded] = useState(true);

  useEffect(() => {
    if (externalModalVisible) {
      setProviderSearchVisible(true);
      onExternalModalClose?.();
    }
  }, [externalModalVisible, onExternalModalClose]);

  const load = useCallback(async (id: string) => {
    const data = await loadEmployeeHomeData(id);
    setAsProvider(data.asProvider);
    setAsClient(data.asClient);
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const cached = peekHomePrefetch(userId);
    if (cached?.variant === 'employee') {
      setAsProvider(cached.providerAppointments ?? []);
      setAsClient(cached.userAppointments);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void load(userId).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load, userId]);

  const onRefresh = async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      await Promise.all([load(userId), refreshFavorites()]);
    } catch (e) {
      console.error('EmployeeHomeScreen refresh:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const openSchedule = () => router.push('/schedule');
  const openProvider = (providerId: string) => router.push(`/profile/${providerId}`);

  const firstName = user?.user_metadata?.first_name;
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerGreeting}>
              {greeting}
              {firstName ? `, ${firstName}` : ''}
            </Text>
            <Text style={styles.headerTitle}>Home</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => router.push('/account')}
              accessibilityLabel="Account"
            >
              <Ionicons name="person-outline" size={22} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.secondary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <TodaySection
            title="Today as provider"
            accentColor="#2563EB"
            appointments={asProvider}
            emptyText="No client appointments today"
            onPressRow={openSchedule}
            renderSubtitle={(appt) =>
              profileDisplayName(appt.user?.first_name, appt.user?.last_name, 'Client')
            }
          />

          <TodaySection
            title="Today as client"
            accentColor="#16A34A"
            appointments={asClient}
            emptyText="No personal bookings today"
            onPressRow={openSchedule}
            renderSubtitle={(appt) =>
              profileDisplayName(
                appt.provider?.first_name,
                appt.provider?.last_name,
                'Provider'
              )
            }
          />

          <Pressable
            style={[styles.collapsibleSectionHeader, styles.collapsibleSectionHeaderSpaced]}
            onPress={() => setFavoritesExpanded((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: favoritesExpanded }}
          >
            <Text style={styles.sectionTitleInline}>Favorite services</Text>
            <View style={styles.collapsibleSectionHeaderRight}>
              {favorites.length > 0 ? (
                <Text style={styles.sectionCountInline}>{favorites.length}</Text>
              ) : null}
              <Ionicons
                name={favoritesExpanded ? 'chevron-down' : 'chevron-forward'}
                size={20}
                color={theme.colors.textSecondary}
              />
            </View>
          </Pressable>
          {favoritesExpanded ? (
            favorites.length === 0 ? (
              <Card style={styles.emptyCard} variant="outlined">
                <Ionicons name="heart-outline" size={32} color={theme.colors.border} />
                <Text style={styles.emptyTitle}>No favorites yet</Text>
                <Text style={styles.emptySubtitle}>
                  Scan a provider QR code or visit their profile to save them here.
                </Text>
              </Card>
            ) : (
              favorites.map((fav) => {
                const p = fav.profiles;
                if (!p) return null;
                const name = profileDisplayName(p.first_name, p.last_name);
                const subtitle = p.job_title || p.business_name || 'Service Provider';
                return (
                  <Pressable key={fav.id} onPress={() => openProvider(fav.provider_id)}>
                    <Card style={styles.favCard} variant="elevated">
                      <View style={styles.favTop}>
                        <ProviderAvatar name={name} size={48} />
                        <View style={styles.favInfo}>
                          <Text style={styles.favName}>{name}</Text>
                          <Text style={styles.favSubtitle} numberOfLines={1}>
                            {subtitle}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
                      </View>
                    </Card>
                  </Pressable>
                );
              })
            )
          ) : null}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      <NewMessageSheet
        visible={providerSearchVisible}
        title="Find a provider"
        searchPlaceholder="Search by name or specialty..."
        excludeFavorites
        onClose={() => setProviderSearchVisible(false)}
        onSelectProvider={(providerId) => {
          setProviderSearchVisible(false);
          openProvider(providerId);
        }}
      />
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    headerSafeArea: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: theme.spacing.md,
    },
    headerGreeting: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 2,
    },
    headerTitle: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.sizes.h1,
      color: theme.colors.textPrimary,
    },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: theme.spacing.md },
    sectionBlock: { marginBottom: theme.spacing.lg },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    sectionAccent: { width: 4, height: 18, borderRadius: 2 },
    sectionTitleInline: {
      flex: 1,
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.title,
      color: theme.colors.textPrimary,
    },
    seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    seeAllText: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.secondary,
    },
    upcomingEmpty: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    upcomingEmptyText: {
      flex: 1,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
    },
    upcomingCompactCard: {
      paddingVertical: 0,
      paddingHorizontal: 0,
      overflow: 'hidden',
    },
    upcomingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: 10,
      paddingHorizontal: theme.spacing.md,
    },
    upcomingRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    upcomingRowText: { flex: 1, minWidth: 0 },
    upcomingRowPrimary: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textPrimary,
    },
    upcomingRowSecondary: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    upcomingMoreRow: {
      justifyContent: 'space-between',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    upcomingMoreText: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.secondary,
    },
    collapsibleSectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    collapsibleSectionHeaderSpaced: { marginTop: theme.spacing.sm },
    collapsibleSectionHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    sectionCountInline: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
    },
    emptyCard: {
      alignItems: 'center',
      padding: theme.spacing.xl,
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
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
    },
    favCard: { marginBottom: theme.spacing.md, padding: theme.spacing.md },
    favTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    favInfo: { flex: 1 },
    favName: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
    },
    favSubtitle: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    bottomSpacer: { height: 110 },
  });
}
