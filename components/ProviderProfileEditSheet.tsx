import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFullScreenSheetTopInset } from '../hooks/use-full-screen-sheet-top-inset';
import type { AppTheme } from '../constants/theme';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import { Button } from './Button';
import { ServicesOfferInput } from './ServicesOfferInput';
import { useAuth } from '../contexts/AuthContext';
import type { ProviderProfilePayload } from '../lib/providerProfile';
import { persistEmployeeStructuredData } from '../lib/onboardingPersistence';
import { buildScheduleProfileFields, slotsToSchedule, type DayTiming } from '../lib/profileSchedule';
import { ProfileScheduleEditor } from './ProfileScheduleEditor';
import { listEmployeeServiceOffers } from '../lib/employeeServices';
import {
  isCompleteServiceOffer,
  normalizeServiceOffers,
  serviceOffersToProfileString,
  type ServiceOffer,
} from '../lib/serviceOffer';

type ProviderProfileEditSheetProps = {
  visible: boolean;
  profile: ProviderProfilePayload;
  onClose: () => void;
  onSaved: () => void;
};

export function ProviderProfileEditSheet({
  visible,
  profile,
  onClose,
  onSaved,
}: ProviderProfileEditSheetProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const topInset = useFullScreenSheetTopInset();
  const { user, updateProfile } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('');
  const [services, setServices] = useState<ServiceOffer[]>([]);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [dayTimings, setDayTimings] = useState<Record<string, DayTiming>>({});
  const [flexibleHours, setFlexibleHours] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);

  useEffect(() => {
    if (!visible) return;

    setFirstName(profile.first_name ?? '');
    setLastName(profile.last_name ?? '');
    setJobTitle(profile.job_title ?? '');
    setBusinessName(profile.business_name ?? '');
    setBio(profile.bio ?? '');
    setPhone(profile.phone ?? '');
    setEmail(profile.email ?? '');
    setWebsite(profile.website ?? '');
    setLocation(profile.location ?? '');
    setServices(normalizeServiceOffers(profile.services ?? []));
    const schedule = slotsToSchedule(profile.availability ?? []);
    setSelectedDays(schedule.selectedDays);
    setDayTimings(schedule.dayTimings);
    setFlexibleHours(Boolean(profile.flexible_hours));

    if (!user?.id) return;

    let cancelled = false;
    (async () => {
      setLoadingServices(true);
      try {
        const structuredServices = await listEmployeeServiceOffers(user.id);
        if (!cancelled && structuredServices.length > 0) {
          setServices(structuredServices);
        }
      } catch {
        // Fall back to profile.services names already loaded above.
      } finally {
        if (!cancelled) setLoadingServices(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, profile, user?.id]);

  const handleScheduleChange = (days: string[], timings: Record<string, DayTiming>) => {
    setSelectedDays(days);
    setDayTimings(timings);
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Missing information', 'First and last name are required.');
      return;
    }

    const incompleteService = services.find((service) => !isCompleteServiceOffer(service));
    if (incompleteService) {
      Alert.alert(
        'Service details required',
        `Add a time estimate and cost for "${incompleteService.name}", or remove it to save.`
      );
      return;
    }

    setSaving(true);
    try {
      const { work_days, timings } = buildScheduleProfileFields(selectedDays, dayTimings);

      await updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        job_title: jobTitle.trim() || undefined,
        business_name: businessName.trim() || undefined,
        bio: bio.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
        location: location.trim() || undefined,
        services: services.length > 0 ? serviceOffersToProfileString(services) : undefined,
        work_days: work_days || undefined,
        timings: timings || undefined,
        flexible_hours: flexibleHours,
      });

      if (user?.id) {
        await persistEmployeeStructuredData(user.id, services, selectedDays, dayTimings);
      }

      onSaved();
      onClose();
    } catch {
      Alert.alert('Error', 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={[styles.header, { paddingTop: topInset + theme.spacing.md }]}>
          <Text style={styles.title}>Edit profile</Text>
          <TouchableOpacity onPress={onClose} disabled={saving}>
            <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.groupTitle}>Name</Text>
          <Field label="First name" value={firstName} onChangeText={setFirstName} />
          <Field label="Last name" value={lastName} onChangeText={setLastName} />

          <Text style={styles.groupTitle}>Work</Text>
          <Field label="Job title" value={jobTitle} onChangeText={setJobTitle} />
          <Field label="Business name" value={businessName} onChangeText={setBusinessName} />
          <Field label="Bio" value={bio} onChangeText={setBio} multiline />

          <Text style={styles.groupTitle}>Contact</Text>
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <Field label="Website" value={website} onChangeText={setWebsite} autoCapitalize="none" />
          <Field label="Location" value={location} onChangeText={setLocation} />

          <Text style={styles.groupTitle}>Services</Text>
          {loadingServices ? (
            <ActivityIndicator color={theme.colors.secondary} style={styles.servicesLoader} />
          ) : (
            <ServicesOfferInput services={services} onChangeServices={setServices} />
          )}

          <Text style={styles.groupTitle}>Availability</Text>
          <ProfileScheduleEditor
            selectedDays={selectedDays}
            dayTimings={dayTimings}
            flexibleHours={flexibleHours}
            onFlexibleHoursChange={setFlexibleHours}
            onChange={handleScheduleChange}
          />

          <Button
            title={saving ? 'Saving…' : 'Save changes'}
            onPress={() => void handleSave()}
            disabled={saving}
          />
          {saving ? <ActivityIndicator color={theme.colors.secondary} /> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences';
}) {
  const styles = useThemedStyles(createFieldStyles);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        placeholderTextColor="#94A3B8"
      />
    </View>
  );
}

function createFieldStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrap: { marginBottom: theme.spacing.md },
    label: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
      marginBottom: 6,
    },
    input: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 12,
    },
    inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  });
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    title: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.sizes.title,
      color: theme.colors.textPrimary,
    },
    form: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
    groupTitle: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    servicesLoader: {
      marginBottom: theme.spacing.md,
    },
  });
}
