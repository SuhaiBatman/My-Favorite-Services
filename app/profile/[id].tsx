import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { AppTheme } from '../../constants/theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../hooks/use-themed-styles';
import { ProviderAvatar } from '../../components/ProviderAvatar';
import { useAuth } from '../../contexts/AuthContext';
import { getOrCreateConversation } from '../../lib/messaging';
import {
  fetchProviderProfile,
  type ProviderAvailabilitySlot,
  type ProviderProfilePayload,
} from '../../lib/providerProfile';
import { profileDisplayName } from '../../lib/format';
import { listEmployeeServiceOffers } from '../../lib/employeeServices';
import { formatServiceDuration, formatServicePrice, type ServiceOffer } from '../../lib/serviceOffer';
import { ProviderProfileEditSheet } from '../../components/ProviderProfileEditSheet';
import { UserBookAppointmentModal } from '../../components/UserBookAppointmentModal';
import { Button } from '../../components/Button';
import {
  FloatingGlassButton,
  floatingGlassButtonReservedHeight,
} from '../../components/FloatingGlassButton';
import { deleteOwnAccount } from '../../lib/deleteAccount';
import { useFavorites } from '../../contexts/FavoritesContext';
import { supabase } from '../../lib/supabase';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(minutes: number): string {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
}

function formatAvailabilityRow(slot: ProviderAvailabilitySlot): string {
  const day = DAYS[slot.day_of_week] ?? `Day ${slot.day_of_week}`;
  return `${day}: ${formatTime(slot.start_minutes)} - ${formatTime(slot.end_minutes)}`;
}

export default function ProviderProfileScreen() {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, session } = useAuth();
  const { isFavorite: isProviderFavorite, addFavorite: addToFavorites } = useFavorites();

  const [profile, setProfile] = useState<ProviderProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [bookVisible, setBookVisible] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [serviceOffers, setServiceOffers] = useState<ServiceOffer[]>([]);

  const profileId = typeof id === 'string' ? id : id?.[0];
  const isOwnProfile = Boolean(user?.id && profileId && user.id === profileId);

  const loadProfile = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const payload = await fetchProviderProfile(profileId);
      setProfile(payload);
      try {
        const offers = await listEmployeeServiceOffers(profileId);
        setServiceOffers(offers);
      } catch {
        setServiceOffers([]);
      }
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const displayName = profileDisplayName(profile?.first_name, profile?.last_name);
  const subtitle = profile?.job_title || profile?.business_name || 'Service Provider';
  const serviceList = serviceOffers.length > 0
    ? serviceOffers
    : (profile?.services ?? []).map((name) => ({
        name,
        durationMinutes: 0,
        priceCents: 0,
      }));
  const availabilityList = profile?.availability ?? [];
  const aboutText = [profile?.bio, profile?.business_description].filter(Boolean).join('\n\n');
  const hasContactInfo = Boolean(
    profile?.phone || profile?.email || profile?.website || profile?.location
  );

  const handleMessage = async () => {
    if (!profileId) return;
    if (!session || !user) {
      router.push('/(auth)/login');
      return;
    }
    setMessageLoading(true);
    try {
      const conversationId = await getOrCreateConversation(profileId);
      router.push(`/chat/${conversationId}`);
    } catch {
      Alert.alert('Error', 'Could not start a conversation.');
    } finally {
      setMessageLoading(false);
    }
  };

  const handleBook = () => {
    if (!profileId) return;
    if (!session || !user) {
      router.push('/(auth)/login');
      return;
    }
    if (user.id === profileId) {
      Alert.alert("That's you!", 'You cannot book your own services.');
      return;
    }
    setBookVisible(true);
  };

  const handleAddToFavorites = async () => {
    if (!profileId) return;
    if (!session || !user) {
      router.push('/(auth)/login');
      return;
    }
    if (user.id === profileId) {
      Alert.alert("That's you!", 'You cannot add yourself to favorites.');
      return;
    }
    if (!profile) return;
    setAddLoading(true);
    try {
      await addToFavorites(profileId, {
        id: profileId,
        first_name: profile.first_name,
        last_name: profile.last_name,
        job_title: profile.job_title,
        business_name: profile.business_name,
        bio: profile.bio,
        services: profile.services?.join(', ') ?? null,
        location: profile.location,
      });
    } catch {
      Alert.alert('Error', 'Could not add this provider to your favorites.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleFloatingAction = () => {
    if (profile?.is_favorite) {
      handleBook();
    } else {
      void handleAddToFavorites();
    }
  };

  const isFavorite = profileId
    ? isProviderFavorite(profileId) || Boolean(profile?.is_favorite)
    : false;

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open link.'));
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your profile, appointments, messages, favorites, and all other data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete account permanently?',
              'Your account and all associated data will be removed from our servers.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete account',
                  style: 'destructive',
                  onPress: async () => {
                    setDeletingAccount(true);
                    try {
                      await deleteOwnAccount();
                      router.replace('/(auth)/login');
                    } catch {
                      Alert.alert('Error', 'Could not delete your account. Please try again.');
                    } finally {
                      setDeletingAccount(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.secondary} />
      </View>
    );
  }

  const bottomChromeInset = Math.max(insets.bottom, 24);
  const scrollBottomPadding = !isOwnProfile
    ? floatingGlassButtonReservedHeight(bottomChromeInset) + theme.spacing.md
    : theme.spacing.xl;

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.textInverted} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Ionicons name="person-outline" size={48} color={theme.colors.textSecondary} />
          <Text style={styles.emptyTitle}>Profile not found</Text>
          <Text style={styles.emptySubtitle}>This provider may no longer be available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
      >
        <View style={styles.hero}>
          <View style={[styles.heroBar, { paddingTop: insets.top }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.colors.textInverted} />
            </TouchableOpacity>
            {isOwnProfile ? (
              <TouchableOpacity
                onPress={() => setEditVisible(true)}
                style={styles.editButton}
                accessibilityLabel="Edit profile"
              >
                <Ionicons name="create-outline" size={22} color={theme.colors.textInverted} />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatarRing}>
            <ProviderAvatar name={displayName} size={96} />
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {profile.industry ? (
            <Text style={styles.industryLine}>{profile.industry}</Text>
          ) : null}
          {profile.business_name && profile.job_title ? (
            <Text style={styles.companyLine}>{profile.business_name}</Text>
          ) : null}

          {!isOwnProfile ? (
            <TouchableOpacity
              style={styles.messageButton}
              onPress={handleMessage}
              disabled={messageLoading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Message"
            >
              {messageLoading ? (
                <ActivityIndicator size="small" color={theme.colors.secondary} />
              ) : (
                <>
                  <Ionicons name="chatbubble-outline" size={20} color={theme.colors.secondary} />
                  <Text style={styles.messageButtonLabel}>Message</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.body}>
          {aboutText ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bodyText}>{aboutText}</Text>
            </View>
          ) : null}

          {hasContactInfo ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>
            {profile.phone ? (
              <Pressable style={styles.contactRow} onPress={() => openLink(`tel:${profile.phone}`)}>
                <View style={styles.contactIcon}>
                  <Ionicons name="call-outline" size={18} color={theme.colors.secondary} />
                </View>
                <Text style={styles.contactValue}>{profile.phone}</Text>
              </Pressable>
            ) : null}
            {profile.email ? (
              <Pressable style={styles.contactRow} onPress={() => openLink(`mailto:${profile.email}`)}>
                <View style={styles.contactIcon}>
                  <Ionicons name="mail-outline" size={18} color={theme.colors.secondary} />
                </View>
                <Text style={styles.contactValue}>{profile.email}</Text>
              </Pressable>
            ) : null}
            {profile.website ? (
              <Pressable
                style={styles.contactRow}
                onPress={() => openLink(profile.website!.startsWith('http') ? profile.website! : `https://${profile.website}`)}
              >
                <View style={styles.contactIcon}>
                  <Ionicons name="globe-outline" size={18} color={theme.colors.secondary} />
                </View>
                <Text style={styles.contactValue} numberOfLines={1}>
                  {profile.website}
                </Text>
              </Pressable>
            ) : null}
            {profile.location ? (
              <View style={styles.contactRow}>
                <View style={styles.contactIcon}>
                  <Ionicons name="location-outline" size={18} color={theme.colors.secondary} />
                </View>
                <Text style={styles.contactValue}>{profile.location}</Text>
              </View>
            ) : null}
          </View>
          ) : null}

          {serviceList.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Services</Text>
              {serviceList.map((service) => (
                <View key={service.name} style={styles.serviceRow}>
                  <Ionicons name="checkmark-circle" size={18} color={theme.colors.secondary} />
                  <View style={styles.serviceTextWrap}>
                    <Text style={styles.serviceText}>{service.name}</Text>
                    {service.durationMinutes > 0 || service.priceCents > 0 ? (
                      <Text style={styles.serviceMeta}>
                        {[formatServiceDuration(service.durationMinutes), formatServicePrice(service.priceCents)]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {availabilityList.length > 0 || profile.flexible_hours ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Availability</Text>
              {profile.flexible_hours ? (
                <View style={styles.flexibleHoursRow}>
                  <Ionicons name="checkmark-circle" size={18} color={theme.colors.secondary} />
                  <Text style={styles.flexibleHoursText}>
                    Flexible hours — listed times may vary from week to week.
                  </Text>
                </View>
              ) : null}
              {availabilityList.map((slot) => (
                <Text
                  key={`${slot.day_of_week}-${slot.start_minutes}`}
                  style={styles.scheduleRow}
                >
                  {formatAvailabilityRow(slot)}
                </Text>
              ))}
            </View>
          ) : null}

          {isOwnProfile ? (
            <View style={styles.dangerZone}>
              <Button
                title="Sign out"
                variant="destructive"
                onPress={handleSignOut}
                disabled={deletingAccount}
              />
              <Button
                title="Delete account"
                variant="destructiveFilled"
                onPress={handleDeleteAccount}
                loading={deletingAccount}
                disabled={deletingAccount}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>

      {isOwnProfile && profile ? (
        <ProviderProfileEditSheet
          visible={editVisible}
          profile={profile}
          onClose={() => setEditVisible(false)}
          onSaved={() => void loadProfile()}
        />
      ) : null}

      {!isOwnProfile ? (
        <FloatingGlassButton
          label={isFavorite ? 'Book' : 'Add'}
          icon={isFavorite ? 'calendar-outline' : 'add'}
          onPress={handleFloatingAction}
          loading={addLoading}
          bottomInset={bottomChromeInset}
        />
      ) : null}

      {!isOwnProfile && profileId && profile ? (
        <UserBookAppointmentModal
          visible={bookVisible}
          onClose={() => setBookVisible(false)}
          onBooked={() => undefined}
          initialProviderId={profileId}
          initialProvider={{
            id: profileId,
            first_name: profile.first_name,
            last_name: profile.last_name,
            job_title: profile.job_title,
            business_name: profile.business_name,
            location: profile.location,
          }}
        />
      ) : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  hero: {
    height: 160,
    backgroundColor: theme.colors.primary,
  },
  heroBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.sm,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
  },
  editButtonText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textInverted,
  },
  headerBar: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    marginTop: -56,
    marginHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    paddingTop: 56,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarRing: {
    position: 'absolute',
    top: -48,
    borderWidth: 4,
    borderColor: theme.colors.surface,
    borderRadius: 56,
  },
  name: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: 26,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  companyLine: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  industryLine: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.lg,
  },
  messageButtonLabel: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.secondary,
  },
  body: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  bodyText: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactValue: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textPrimary,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
  },
  serviceTextWrap: {
    flex: 1,
    gap: 2,
  },
  serviceText: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textPrimary,
  },
  serviceMeta: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
  },
  scheduleRow: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  flexibleHoursRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  flexibleHoursText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textSecondary,
  },
  emptyTitle: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.title,
    color: theme.colors.textPrimary,
  },
  emptySubtitle: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  dangerZone: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  });
}
