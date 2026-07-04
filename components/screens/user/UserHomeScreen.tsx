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
  Alert,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { AppTheme } from '../../../constants/theme';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { useThemedStyles } from '../../../hooks/use-themed-styles';
import { Card } from '../../Card';
import { ProviderAvatar } from '../../ProviderAvatar';
import { useAuth } from '../../../contexts/AuthContext';
import type { Appointment } from '../../../lib/appointments';
import { loadUserHomeData } from '../../../lib/homeLoad';
import { NewMessageSheet } from '../../NewMessageSheet';
import {
  formatAppointmentTime,
  isAppointmentOnLocalDay,
  profileDisplayName,
} from '../../../lib/format';
import { useFavorites } from '../../../contexts/FavoritesContext';
import { peekHomePrefetch } from '../../../lib/homePrefetch';
import type { FavoriteProvider } from '../../../lib/favorites';
import { getOrCreateConversation } from '../../../lib/messaging';
import {
  FavoriteActionsSheet,
  type FavoriteActionKey,
} from '../../FavoriteActionsSheet';
import { UserBookAppointmentModal } from '../../UserBookAppointmentModal';
import { NotificationBellButton } from '../../NotificationBellButton';

const HOME_UPCOMING_PREVIEW_LIMIT = 3;
interface UserHomeScreenProps {
  externalModalVisible?: boolean;
  onExternalModalClose?: () => void;
}

export default function UserHomeScreen({
  externalModalVisible,
  onExternalModalClose,
}: UserHomeScreenProps = {}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const { user, session } = useAuth();
  const userId = user?.id ?? session?.user?.id ?? null;
  const { favorites, refresh: refreshFavorites, removeFavorite } = useFavorites();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [providerSearchVisible, setProviderSearchVisible] = useState(false);
  const [favoritesExpanded, setFavoritesExpanded] = useState(true);
  const [actionFavorite, setActionFavorite] = useState<FavoriteProvider | null>(null);
  const [actionAnchorY, setActionAnchorY] = useState<number | null>(null);
  const [bookModalVisible, setBookModalVisible] = useState(false);
  const [bookProviderId, setBookProviderId] = useState<string | null>(null);
  useEffect(() => {
    if (externalModalVisible) {
      setProviderSearchVisible(true);
      onExternalModalClose?.();
    }
  }, [externalModalVisible, onExternalModalClose]);

  const load = useCallback(async (id: string) => {
    const data = await loadUserHomeData(id);
    setAppointments(data.appointments);
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const cached = peekHomePrefetch(userId);
    if (cached?.variant === 'user') {
      setAppointments(cached.userAppointments);
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
      console.error('UserHomeScreen refresh:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const openProvider = (providerId: string) => {
    router.push(`/profile/${providerId}`);
  };

  const openSchedule = () => router.push('/schedule');

  const openFavoriteActions = (favorite: FavoriteProvider, event?: GestureResponderEvent) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionFavorite(favorite);
    setActionAnchorY(event?.nativeEvent.pageY ?? null);
  };

  const closeFavoriteActions = () => {
    setActionFavorite(null);
    setActionAnchorY(null);
  };

  const messageProvider = async (providerId: string) => {
    try {
      const conversationId = await getOrCreateConversation(providerId);
      router.push(`/chat/${conversationId}`);
    } catch (e) {
      console.error('messageProvider:', e);
      Alert.alert('Error', 'Could not start a conversation. Please try again.');
    }
  };

  const runFavoriteAction = async (action: FavoriteActionKey) => {
    const favorite = actionFavorite;
    if (!favorite) return;
    const providerId = favorite.provider_id;
    const profile = favorite.profiles;
    const name = profileDisplayName(profile?.first_name, profile?.last_name);
    closeFavoriteActions();

    switch (action) {
      case 'viewProfile':
        openProvider(providerId);
        break;
      case 'book':
        setBookProviderId(providerId);
        setBookModalVisible(true);
        break;
      case 'message':
        await messageProvider(providerId);
        break;
      case 'remove':
        Alert.alert(
          'Remove from favorites?',
          `${name} will be removed from your favorites.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () => {
                void removeFavorite(providerId).catch((e) => {
                  console.error('removeFavorite:', e);
                  Alert.alert('Error', 'Could not remove this favorite. Please try again.');
                });
              },
            },
          ]
        );
        break;
    }
  };

  const todayAppointments = useMemo(
    () => appointments.filter((a) => isAppointmentOnLocalDay(a.starts_at)),
    [appointments]
  );
  const previewAppointments = todayAppointments.slice(0, HOME_UPCOMING_PREVIEW_LIMIT);
  const hasMoreToday = todayAppointments.length > HOME_UPCOMING_PREVIEW_LIMIT;

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
            <NotificationBellButton style={styles.headerBtn} />
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.upcomingSectionHeader}>
            <Text style={styles.sectionTitleInline}>Today</Text>
            {todayAppointments.length > 0 ? (
              <TouchableOpacity
                style={styles.seeAllBtn}
                onPress={openSchedule}
                accessibilityLabel="See full schedule"
              >
                <Text style={styles.seeAllText}>Schedule</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.secondary} />
              </TouchableOpacity>
            ) : null}
          </View>
          {todayAppointments.length === 0 ? (
            <Pressable onPress={openSchedule} accessibilityRole="button">
              <View style={styles.upcomingEmpty}>
                <Ionicons name="calendar-outline" size={18} color={theme.colors.textSecondary} />
                <Text style={styles.upcomingEmptyText}>Nothing today — see Schedule for later</Text>
              </View>
            </Pressable>
          ) : (
            <Card style={styles.upcomingCompactCard} variant="outlined">
              {previewAppointments.map((appt, index) => {
                const providerName = profileDisplayName(
                  appt.provider?.first_name,
                  appt.provider?.last_name
                );
                const isLast = index === previewAppointments.length - 1 && !hasMoreToday;
                return (
                  <Pressable
                    key={appt.id}
                    style={[styles.upcomingRow, !isLast && styles.upcomingRowBorder]}
                    onPress={openSchedule}
                    accessibilityRole="button"
                    accessibilityLabel={`${providerName}, ${appt.service_name}, ${formatAppointmentTime(appt.starts_at)}`}
                  >
                    <ProviderAvatar name={providerName} size={28} />
                    <View style={styles.upcomingRowText}>
                      <Text style={styles.upcomingRowPrimary} numberOfLines={1}>
                        {`${formatAppointmentTime(appt.starts_at)} · ${providerName}`}
                      </Text>
                      <Text style={styles.upcomingRowSecondary} numberOfLines={1}>
                        {appt.service_name}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.border} />
                  </Pressable>
                );
              })}
              {hasMoreToday ? (
                <Pressable
                  style={[styles.upcomingRow, styles.upcomingMoreRow]}
                  onPress={openSchedule}
                  accessibilityRole="button"
                  accessibilityLabel={`${todayAppointments.length - HOME_UPCOMING_PREVIEW_LIMIT} more today on Schedule`}
                >
                  <Text style={styles.upcomingMoreText}>
                    +{todayAppointments.length - HOME_UPCOMING_PREVIEW_LIMIT} more today on Schedule
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.secondary} />
                </Pressable>
              ) : null}
            </Card>
          )}

          <Pressable
            style={[styles.collapsibleSectionHeader, styles.collapsibleSectionHeaderSpaced]}
            onPress={() => setFavoritesExpanded((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: favoritesExpanded }}
            accessibilityLabel="Favorite services"
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
                const services = p.services
                  ? p.services.split(',').map((s) => s.trim()).filter(Boolean)
                  : [];
                return (
                  <Pressable
                    key={fav.id}
                    onPress={() => openProvider(fav.provider_id)}
                    onLongPress={(event) => openFavoriteActions(fav, event)}
                    delayLongPress={360}
                  >
                    <Card style={styles.favCard} variant="elevated">
                      <View style={styles.favTop}>
                        <ProviderAvatar name={name} size={48} />
                        <View style={styles.favInfo}>
                          <Text style={styles.favName}>{name}</Text>
                          <Text style={styles.favSubtitle} numberOfLines={1}>
                            {subtitle}
                          </Text>
                          {p.location ? (
                            <View style={styles.locationRow}>
                              <Ionicons name="location-outline" size={12} color={theme.colors.textSecondary} />
                              <Text style={styles.locationText} numberOfLines={1}>
                                {p.location}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
                      </View>
                      {services.length > 0 ? (
                        <View style={styles.servicesRow}>
                          {services.slice(0, 3).map((s) => (
                            <View key={s} style={styles.serviceChip}>
                              <Text style={styles.serviceChipText}>{s}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
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

      <FavoriteActionsSheet
        visible={actionFavorite !== null}
        favorite={actionFavorite}
        anchorY={actionAnchorY}
        onClose={closeFavoriteActions}
        onAction={(action) => {
          void runFavoriteAction(action);
        }}
      />

      <UserBookAppointmentModal
        visible={bookModalVisible}
        initialProviderId={bookProviderId}
        onClose={() => {
          setBookModalVisible(false);
          setBookProviderId(null);
        }}
        onBooked={() => {
          setBookModalVisible(false);
          setBookProviderId(null);
          openSchedule();
        }}
      />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: theme.spacing.md,
  },
  collapsibleSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  collapsibleSectionHeaderSpaced: {
    marginTop: theme.spacing.lg,
  },
  collapsibleSectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionTitleInline: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.title,
    color: theme.colors.textPrimary,
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
  upcomingSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
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
    marginBottom: theme.spacing.md,
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
    marginBottom: theme.spacing.md,
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
  upcomingRowText: {
    flex: 1,
    minWidth: 0,
  },
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
  favCard: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  favTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  favInfo: {
    flex: 1,
  },
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
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 11,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  servicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  serviceChip: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  serviceChipText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: 11,
    color: theme.colors.textPrimary,
  },
  bottomSpacer: {
    height: 110,
  },
  });
}