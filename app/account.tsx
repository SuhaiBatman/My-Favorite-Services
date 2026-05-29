import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ProviderAvatar } from '../components/ProviderAvatar';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { ChangeCredentialSheet } from '../components/ChangeCredentialSheet';
import { useAuth } from '../contexts/AuthContext';
import {
  ColorSchemePreference,
  useAppTheme,
} from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import type { AppTheme } from '../constants/theme';
import { profileDisplayName } from '../lib/format';
import { fetchConfirmedContact, type ConfirmedContact } from '../lib/accountCredentials';
import { deleteOwnAccount } from '../lib/deleteAccount';
import { supabase } from '../lib/supabase';

const APPEARANCE_OPTIONS: {
  value: ColorSchemePreference;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

function createStyles(theme: AppTheme) {
  return {
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    headerTitle: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
    },
    scroll: {
      padding: theme.spacing.md,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    profileCard: {
      alignItems: 'center' as const,
      paddingVertical: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    name: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.sizes.h2,
      color: theme.colors.textPrimary,
      textAlign: 'center' as const,
    },
    email: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.textSecondary,
      textAlign: 'center' as const,
    },
    roleBadge: {
      marginTop: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primaryLight,
    },
    roleText: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.primary,
      textTransform: 'capitalize' as const,
    },
    sectionTitle: {
      fontFamily: theme.typography.fontFamily.semiBold,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
    },
    appearanceRow: {
      flexDirection: 'row' as const,
      gap: theme.spacing.sm,
    },
    appearanceOption: {
      flex: 1,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      gap: theme.spacing.xs,
    },
    appearanceOptionActive: {
      borderColor: theme.colors.secondary,
      backgroundColor: theme.colors.primaryLight,
    },
    appearanceLabel: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textPrimary,
    },
    appearanceLabelActive: {
      color: theme.colors.secondary,
    },
    linkRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    linkIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: theme.colors.background,
    },
    linkText: {
      flex: 1,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.subbody,
      color: theme.colors.textPrimary,
    },
    contactValue: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    contactCopy: {
      flex: 1,
    },
    dangerZone: {
      gap: theme.spacing.sm,
    },
  };
}

export default function AccountScreen() {
  const router = useRouter();
  const { user, role } = useAuth();
  const { theme, preference, setPreference, isDark } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const meta = user?.user_metadata ?? {};
  const [displayEmail, setDisplayEmail] = useState('');
  const [displayPhone, setDisplayPhone] = useState('');
  const [confirmedContact, setConfirmedContact] = useState<ConfirmedContact>({
    email: '',
    phone: '',
    authPhoneE164: null,
  });
  const [credentialSheet, setCredentialSheet] = useState<'email' | 'phone' | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const reloadContact = React.useCallback(async () => {
    const contact = await fetchConfirmedContact(user);
    setConfirmedContact(contact);
    setDisplayEmail(contact.email);
    setDisplayPhone(contact.phone);
  }, [user]);

  React.useEffect(() => {
    void reloadContact();
  }, [reloadContact]);

  const displayName = profileDisplayName(meta.first_name, meta.last_name) || 'Your profile';
  const subtitle = meta.job_title || meta.business_name;

  const handleCredentialSuccess = (type: 'email' | 'phone', value: string) => {
    if (type === 'email') {
      setDisplayEmail(value);
      Alert.alert('Email updated', 'Your email has been verified and updated.');
    } else {
      setDisplayPhone(value);
      Alert.alert('Phone updated', 'Your phone number has been verified and updated.');
    }
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

  return (
    <View style={styles.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.backButton} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card variant="outlined">
          <View style={styles.profileCard}>
            <ProviderAvatar name={displayName} size={80} />
            <Text style={styles.name}>{displayName}</Text>
            {subtitle ? (
              <Text style={styles.email}>{subtitle}</Text>
            ) : null}
            {role ? (
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{role}</Text>
              </View>
            ) : null}
          </View>
        </Card>

        <View>
          <Text style={styles.sectionTitle}>Contact</Text>
          <Card variant="outlined">
            <Pressable style={styles.linkRow} onPress={() => setCredentialSheet('email')}>
              <View style={styles.linkIcon}>
                <Ionicons name="mail-outline" size={18} color={theme.colors.secondary} />
              </View>
              <View style={styles.contactCopy}>
                <Text style={styles.linkText}>Email</Text>
                <Text style={styles.contactValue}>{displayEmail || 'Add email'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
            </Pressable>
            <Pressable style={styles.linkRow} onPress={() => setCredentialSheet('phone')}>
              <View style={styles.linkIcon}>
                <Ionicons name="call-outline" size={18} color={theme.colors.secondary} />
              </View>
              <View style={styles.contactCopy}>
                <Text style={styles.linkText}>Phone</Text>
                <Text style={styles.contactValue}>{displayPhone || 'Add phone number'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          </Card>
        </View>

        <View>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.appearanceRow}>
            {APPEARANCE_OPTIONS.map((option) => {
              const active = preference === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.appearanceOption, active && styles.appearanceOptionActive]}
                  onPress={() => setPreference(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons
                    name={option.icon}
                    size={20}
                    color={active ? theme.colors.secondary : theme.colors.textSecondary}
                  />
                  <Text
                    style={[styles.appearanceLabel, active && styles.appearanceLabelActive]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {user?.id && (role === 'employee' || role === 'business') ? (
          <Card variant="outlined">
            <Pressable
              style={styles.linkRow}
              onPress={() => router.push(`/profile/${user.id}`)}
            >
              <View style={styles.linkIcon}>
                <Ionicons name="person-outline" size={18} color={theme.colors.secondary} />
              </View>
              <Text style={styles.linkText}>View & edit public profile</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          </Card>
        ) : null}

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
      </ScrollView>

      <ChangeCredentialSheet
        visible={credentialSheet !== null}
        type={credentialSheet ?? 'email'}
        user={user}
        confirmedContact={confirmedContact}
        onClose={() => setCredentialSheet(null)}
        onDismiss={() => {
          void reloadContact();
        }}
        onSuccess={handleCredentialSuccess}
      />
    </View>
  );
}
