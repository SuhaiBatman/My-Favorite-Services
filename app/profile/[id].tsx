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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { AppTheme } from '../../constants/theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../hooks/use-themed-styles';
import { ProviderAvatar } from '../../components/ProviderAvatar';
import { useAuth } from '../../contexts/AuthContext';
import { addFavorite, removeFavorite } from '../../lib/favorites';
import { getOrCreateConversation } from '../../lib/messaging';
import {
  fetchProviderProfile,
  type ProviderAvailabilitySlot,
  type ProviderProfilePayload,
} from '../../lib/providerProfile';
import { profileDisplayName } from '../../lib/format';
import { ProviderProfileEditSheet } from '../../components/ProviderProfileEditSheet';
import { Button } from '../../components/Button';
import { deleteOwnAccount } from '../../lib/deleteAccount';
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

type ActionButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
};

function ActionButton({ icon, label, onPress, primary }: ActionButtonProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <TouchableOpacity
      style={[styles.actionBtn, primary && styles.actionBtnPrimary]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Ionicons
        name={icon}
        size={22}
        color={primary ? theme.colors.textInverted : theme.colors.secondary}
      />
      <Text style={[styles.actionLabel, primary && styles.actionLabelPrimary]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ProviderProfileScreen() {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, session } = useAuth();

  const [profile, setProfile] = useState<ProviderProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const profileId = typeof id === 'string' ? id : id?.[0];
  const isOwnProfile = Boolean(user?.id && profileId && user.id === profileId);

  const loadProfile = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const payload = await fetchProviderProfile(profileId);
      setProfile(payload);
      setFavorited(Boolean(payload?.is_favorite));
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const displayName = profileDisplayName(profile?.first_name, profile?.last_name);
  const subtitle = profile?.job_title || profile?.business_name || 'Service Provider';
  const serviceList = profile?.services ?? [];
  const availabilityList = profile?.availability ?? [];

  const handleToggleFavorite = async () => {
    if (!profileId) return;

    if (!session || !user) {
      router.push('/(auth)/login');
      return;
    }

    if (user.id === profileId) {
      Alert.alert("That's you!", 'You cannot add your own profile to favorites.');
      return;
    }

    setFavoriteLoading(true);
    try {
      if (favorited) {
        await removeFavorite(profileId, user.id);
        setFavorited(false);
      } else {
        await addFavorite(profileId, user.id);
        setFavorited(true);
      }
    } catch {
      Alert.alert('Error', 'Could not update favorites. Please try again.');
    } finally {
      setFavoriteLoading(false);
    }
  };

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
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.hero}>
          <SafeAreaView edges={['top']} style={styles.heroBar}>
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
          </SafeAreaView>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatarRing}>
            <ProviderAvatar name={displayName} size={96} />
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {profile.business_name && profile.job_title ? (
            <Text style={styles.companyLine}>{profile.business_name}</Text>
          ) : null}

          <View style={styles.actionsRow}>
            {!isOwnProfile ? (
              <>
                <ActionButton
                  icon="chatbubble-outline"
                  label="Message"
                  onPress={handleMessage}
                  primary
                />
                {profile.phone ? (
                  <ActionButton
                    icon="call-outline"
                    label="Call"
                    onPress={() => openLink(`tel:${profile.phone}`)}
                  />
                ) : null}
                {profile.email ? (
                  <ActionButton
                    icon="mail-outline"
                    label="Email"
                    onPress={() => openLink(`mailto:${profile.email}`)}
                  />
                ) : null}
                <ActionButton
                  icon={favorited ? 'heart' : 'heart-outline'}
                  label={favorited ? 'Saved' : 'Save'}
                  onPress={handleToggleFavorite}
                />
              </>
            ) : (
              <ActionButton
                icon="create-outline"
                label="Edit profile"
                onPress={() => setEditVisible(true)}
                primary
              />
            )}
          </View>

          {(messageLoading || favoriteLoading) && (
            <ActivityIndicator style={{ marginTop: 8 }} color={theme.colors.secondary} />
          )}
        </View>

        <View style={styles.body}>
          {profile.bio ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bodyText}>{profile.bio}</Text>
            </View>
          ) : null}

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

          {serviceList.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Services</Text>
              {serviceList.map((service) => (
                <View key={service} style={styles.serviceRow}>
                  <Ionicons name="checkmark-circle" size={18} color={theme.colors.secondary} />
                  <Text style={styles.serviceText}>{service}</Text>
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
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionBtnPrimary: {
    backgroundColor: theme.colors.secondary,
    borderColor: theme.colors.secondary,
  },
  actionLabel: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: 11,
    color: theme.colors.textPrimary,
    marginTop: 4,
  },
  actionLabelPrimary: {
    color: theme.colors.textInverted,
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
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  serviceText: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.subbody,
    color: theme.colors.textPrimary,
    flex: 1,
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