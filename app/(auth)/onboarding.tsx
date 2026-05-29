import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Modal,
  FlatList,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '../../constants/theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../hooks/use-themed-styles';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { persistEmployeeStructuredData } from '../../lib/onboardingPersistence';

type Role = 'user' | 'employee' | 'business';
type Step = 'role' | 'profile' | 'work' | 'business' | 'schedule' | 'interests';

const STEPS_FOR_ROLE: Record<Role, Step[]> = {
  user: ['role', 'profile', 'interests'],
  employee: ['role', 'profile', 'work', 'schedule', 'interests'],
  business: ['role', 'profile', 'business'],
};

const ITEM_HEIGHT = 80;
const PICKER_ITEM_HEIGHT = 50;
const SCREEN_WIDTH = Dimensions.get('window').width;
const INTEREST_CARD_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2;

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const HOURS_WHEEL = ['', '', ...Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')), '', ''];
const MINUTES_WHEEL = ['', '', ...Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')), '', ''];
const AMPM_WHEEL = ['', '', 'AM', 'PM', '', ''];
const AGES = ['', '', ...Array.from({ length: 88 }, (_, i) => (i + 13).toString()), '', ''];

const INDUSTRIES = [
  'Healthcare', 'Beauty & Wellness', 'Fitness & Sports', 'Food & Dining',
  'Education', 'Technology', 'Legal', 'Finance',
  'Real Estate', 'Home Services', 'Automotive', 'Creative & Design',
  'Consulting', 'Pet Services', 'Events & Entertainment', 'Other',
];

const SERVICE_CATEGORIES: { id: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'healthcare', label: 'Healthcare', icon: 'medical-outline' },
  { id: 'beauty', label: 'Beauty', icon: 'sparkles-outline' },
  { id: 'fitness', label: 'Fitness', icon: 'barbell-outline' },
  { id: 'food', label: 'Dining', icon: 'restaurant-outline' },
  { id: 'education', label: 'Education', icon: 'school-outline' },
  { id: 'home', label: 'Home', icon: 'hammer-outline' },
  { id: 'auto', label: 'Auto', icon: 'car-outline' },
  { id: 'creative', label: 'Creative', icon: 'color-palette-outline' },
  { id: 'legal', label: 'Legal', icon: 'document-text-outline' },
  { id: 'finance', label: 'Finance', icon: 'cash-outline' },
  { id: 'pets', label: 'Pets', icon: 'paw-outline' },
  { id: 'events', label: 'Events', icon: 'calendar-outline' },
];

function parseDayTimings(timings: string | null, workDays: string | null): Record<string, { start: string; end: string }> {
  if (!timings || !workDays) return {};
  const result: Record<string, { start: string; end: string }> = {};
  timings.split(', ').forEach(part => {
    const colonIdx = part.indexOf(': ');
    if (colonIdx === -1) return;
    const dayPrefix = part.substring(0, colonIdx);
    const times = part.substring(colonIdx + 2);
    const [start, end] = times.split(' - ');
    const fullDay = DAYS.find(d => d.startsWith(dayPrefix));
    if (fullDay && start && end) result[fullDay] = { start, end };
  });
  return result;
}

export default function OnboardingScreen() {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const { user, setRole, updateProfile } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('role');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const [genderModalVisible, setGenderModalVisible] = useState(false);
  const [ageModalVisible, setAgeModalVisible] = useState(false);
  const [industryModalVisible, setIndustryModalVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [scrolledAge, setScrolledAge] = useState('28');

  const [serviceInput, setServiceInput] = useState('');
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [activeTimeType, setActiveTimeType] = useState<'start' | 'end' | null>(null);
  const [tempTime, setTempTime] = useState({ hour: '09', minute: '00', ampm: 'AM' });

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    middle_initial: '',
    age: '',
    gender: '',
    phone: '',
    email: user?.email || '',
    is_self_employed: false,
    job_title: '',
    services: [] as string[],
    bio: '',
    business_name: '',
    industry: '',
    business_description: '',
    website: '',
    location: '',
    selected_days: [] as string[],
    day_timings: {} as Record<string, { start: string; end: string }>,
    interests: [] as string[],
  });

  const steps = selectedRole ? STEPS_FOR_ROLE[selectedRole] : [];
  const stepIdx = steps.indexOf(step);
  const totalSteps = steps.length;

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (data && !error) {
          setFormData(prev => ({
            ...prev,
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            middle_initial: data.middle_initial || '',
            age: data.age || '',
            gender: data.gender || '',
            phone: data.phone || '',
            email: data.email || user.email || '',
            business_name: data.business_name || '',
            job_title: data.job_title || '',
            bio: data.bio || '',
            services: data.services ? data.services.split(', ').filter(Boolean) : [],
            industry: data.industry || '',
            business_description: data.business_description || '',
            website: data.website || '',
            location: data.location || '',
            is_self_employed: data.is_self_employed || false,
            interests: data.interests ? data.interests.split(', ').filter(Boolean) : [],
            selected_days: data.work_days ? data.work_days.split(', ').filter(Boolean) : [],
            day_timings: parseDayTimings(data.timings, data.work_days),
          }));

          const mappedRole = data.role === 'provider' ? 'employee' : data.role;
          const profileRoles = (data.roles as string[] | null) ?? [];
          const isEmployee =
            mappedRole === 'employee' || profileRoles.includes('employee');
          const primary = isEmployee
            ? 'employee'
            : profileRoles.includes('business') || mappedRole === 'business'
              ? 'business'
              : mappedRole;

          if (primary && ['user', 'employee', 'business'].includes(primary)) {
            setSelectedRole((prev) => prev ?? (primary as Role));
            setStep((prev) => (prev === 'role' ? 'profile' : prev));
          }
        }
      } catch {
        // Profile not found yet, start fresh
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  // ── Helpers ──────────────────────────────────────────────

  const formatPhoneNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 3) return `(${cleaned}`;
    if (cleaned.length <= 6) return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3)}`;
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6, 10)}`;
  };

  const toggleDay = (day: string) => {
    const current = formData.selected_days;
    const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    const sorted = next.sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));
    setFormData({ ...formData, selected_days: sorted });
  };

  const toggleInterest = (id: string) => {
    const current = formData.interests;
    const next = current.includes(id) ? current.filter(i => i !== id) : [...current, id];
    setFormData({ ...formData, interests: next });
  };

  const addService = () => {
    const trimmed = serviceInput.trim();
    if (trimmed && !formData.services.includes(trimmed)) {
      setFormData({ ...formData, services: [...formData.services, trimmed] });
    }
    setServiceInput('');
  };

  const removeService = (service: string) => {
    setFormData({ ...formData, services: formData.services.filter(s => s !== service) });
  };

  const openTimePicker = (day: string, type: 'start' | 'end') => {
    setActiveDay(day);
    setActiveTimeType(type);
    const currentTime = formData.day_timings[day]?.[type] || (type === 'start' ? '09:00 AM' : '05:00 PM');
    const [time, ampm] = currentTime.split(' ');
    const [hour, minute] = time.split(':');
    setTempTime({ hour, minute, ampm });
    setTimePickerVisible(true);
  };

  const closeTimePicker = () => {
    if (activeDay && activeTimeType) {
      const timeStr = `${tempTime.hour}:${tempTime.minute} ${tempTime.ampm}`;
      setFormData({
        ...formData,
        day_timings: {
          ...formData.day_timings,
          [activeDay]: {
            ...(formData.day_timings[activeDay] || { start: '09:00 AM', end: '05:00 PM' }),
            [activeTimeType]: timeStr,
          },
        },
      });
    }
    setTimePickerVisible(false);
  };

  // ── Navigation ──────────────────────────────────────────

  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    setStep('profile');
  };

  const validateCurrentStep = (): boolean => {
    switch (step) {
      case 'profile': {
        const { first_name, last_name, age, gender, phone, email } = formData;
        if (!first_name || !last_name || !age || !gender || !phone || !email) {
          Alert.alert('Missing Information', 'Please fill in all required fields to continue.');
          return false;
        }
        return true;
      }
      case 'work':
        if (!formData.job_title || !formData.business_name) {
          Alert.alert('Missing Information', 'Please enter your job title and business name.');
          return false;
        }
        return true;
      case 'business':
        if (!formData.business_name) {
          Alert.alert('Missing Information', 'Please enter your business name.');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (!validateCurrentStep()) return;
    const currentIdx = steps.indexOf(step);
    if (currentIdx === steps.length - 1) {
      await handleFinishOnboarding();
    } else {
      setStep(steps[currentIdx + 1]);
    }
  };

  const handleBack = () => {
    const currentIdx = steps.indexOf(step);
    if (currentIdx > 0) setStep(steps[currentIdx - 1]);
  };

  const handleFinishOnboarding = async () => {
    setLoading(true);
    try {
      await setRole(selectedRole!);

      let workDaysStr = '';
      let timingsStr = '';

      if (selectedRole === 'employee' && formData.selected_days.length > 0) {
        workDaysStr = formData.selected_days.join(', ');
        timingsStr = formData.selected_days
          .map(day => {
            const start = formData.day_timings[day]?.start || '09:00 AM';
            const end = formData.day_timings[day]?.end || '05:00 PM';
            return `${day.substring(0, 3)}: ${start} - ${end}`;
          })
          .join(', ');
      }

      await updateProfile({
        first_name: formData.first_name,
        last_name: formData.last_name,
        middle_initial: formData.middle_initial,
        age: formData.age,
        gender: formData.gender,
        phone: formData.phone,
        email: formData.email,
        business_name: formData.business_name,
        job_title: formData.job_title,
        timings: timingsStr,
        work_days: workDaysStr,
        bio: formData.bio,
        services: formData.services.join(', '),
        industry: formData.industry,
        business_description: formData.business_description,
        website: formData.website,
        location: formData.location,
        is_self_employed: formData.is_self_employed,
        interests: formData.interests.join(', '),
      });

      if (user?.id) {
        if (selectedRole === 'employee') {
          await persistEmployeeStructuredData(
            user.id,
            formData.services,
            formData.selected_days,
            formData.day_timings
          );
        } else {
          // Keep structured employee tables consistent when role changes away from employee.
          await persistEmployeeStructuredData(user.id, [], [], {});
        }
      }

      router.replace('/(tabs)');
    } catch {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getNextButtonConfig = (): { text: string; icon: keyof typeof Ionicons.glyphMap } => {
    if (!selectedRole) return { text: 'Continue', icon: 'arrow-forward' };
    const currentIdx = steps.indexOf(step);
    const isLast = currentIdx === steps.length - 1;

    if (isLast) {
      if (step === 'interests') {
        return formData.interests.length > 0
          ? { text: 'Get Started', icon: 'checkmark-circle' }
          : { text: 'Skip & Get Started', icon: 'arrow-forward' };
      }
      return { text: 'Complete Setup', icon: 'checkmark-circle' };
    }

    const nextStep = steps[currentIdx + 1];
    switch (nextStep) {
      case 'work': return { text: 'Next: Work Details', icon: 'arrow-forward' };
      case 'schedule': return { text: 'Next: Schedule', icon: 'arrow-forward' };
      case 'business': return { text: 'Next: Business Info', icon: 'arrow-forward' };
      case 'interests': return { text: 'Continue', icon: 'arrow-forward' };
      default: return { text: 'Continue', icon: 'arrow-forward' };
    }
  };

  // ── Step Renderers ──────────────────────────────────────

  const renderStepHeader = (title: string, subtitle?: string) => (
    <View style={styles.header}>
      <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
      </TouchableOpacity>
      <Text style={[styles.title, { marginTop: 16 }]}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );

  const renderSubmitButton = () => {
    const config = getNextButtonConfig();
    return (
      <TouchableOpacity style={styles.submitBtn} onPress={handleNext} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.submitBtnText}>{config.text}</Text>
            <Ionicons name={config.icon} size={20} color="#fff" />
          </>
        )}
      </TouchableOpacity>
    );
  };

  const renderRoleStep = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.welcomeLabel}>WELCOME</Text>
        <Text style={styles.title}>How will you{'\n'}use the app?</Text>
        <Text style={styles.subtitle}>Choose your account type to get started.</Text>
      </View>

      <View style={styles.roleCards}>
        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => handleSelectRole('user')}
          activeOpacity={0.7}
        >
          <View style={[styles.roleIconCircle, { backgroundColor: theme.colors.secondary }]}>
            <Ionicons name="heart" size={26} color="#fff" />
          </View>
          <View style={styles.roleCardContent}>
            <Text style={styles.roleCardTitle}>Find & Save Favorites</Text>
            <Text style={styles.roleCardDesc}>Scan QR codes to discover service providers and add them to your favorites</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => handleSelectRole('employee')}
          activeOpacity={0.7}
        >
          <View style={[styles.roleIconCircle, { backgroundColor: theme.colors.tertiary }]}>
            <Ionicons name="briefcase" size={26} color="#fff" />
          </View>
          <View style={styles.roleCardContent}>
            <Text style={styles.roleCardTitle}>Offer Your Services</Text>
            <Text style={styles.roleCardDesc}>Share your QR code and profile — you can also scan and save other providers as favorites</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => handleSelectRole('business')}
          activeOpacity={0.7}
        >
          <View style={[styles.roleIconCircle, { backgroundColor: theme.colors.primary }]}>
            <Ionicons name="storefront" size={26} color="#fff" />
          </View>
          <View style={styles.roleCardContent}>
            <Text style={styles.roleCardTitle}>Manage a Business</Text>
            <Text style={styles.roleCardDesc}>Add employees under your business and manage your presence</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderProfileStep = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {renderStepHeader('About You', 'Tell us a bit about yourself.')}

        <View style={styles.form}>
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 2 }]}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                placeholder="John"
                placeholderTextColor="#94A3B8"
                value={formData.first_name}
                onChangeText={t => setFormData({ ...formData, first_name: t })}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>M.I.</Text>
              <TextInput
                style={styles.input}
                placeholder="D"
                placeholderTextColor="#94A3B8"
                maxLength={1}
                value={formData.middle_initial}
                onChangeText={t => setFormData({ ...formData, middle_initial: t.toUpperCase() })}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 2 }]}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Doe"
                placeholderTextColor="#94A3B8"
                value={formData.last_name}
                onChangeText={t => setFormData({ ...formData, last_name: t })}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Age</Text>
              <TouchableOpacity style={styles.dropdownInput} onPress={() => setAgeModalVisible(true)}>
                <Text style={[styles.dropdownValue, !formData.age && { color: '#94A3B8' }]}>
                  {formData.age || 'Select'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Gender</Text>
              <TouchableOpacity style={styles.dropdownInput} onPress={() => setGenderModalVisible(true)}>
                <Text style={[styles.dropdownValue, !formData.gender && { color: '#94A3B8' }]}>
                  {formData.gender || 'Select'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="(555) 000-0000"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              maxLength={14}
              value={formData.phone}
              onChangeText={t => setFormData({ ...formData, phone: formatPhoneNumber(t) })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="john@example.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={formData.email}
              onChangeText={t => setFormData({ ...formData, email: t })}
            />
          </View>

          {renderSubmitButton()}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderWorkStep = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {renderStepHeader('Your Work', 'This info will appear on your digital profile that clients can scan.')}

        <View style={styles.form}>
          <TouchableOpacity
            style={[styles.selfEmployedCard, formData.is_self_employed && styles.selfEmployedCardActive]}
            onPress={() => setFormData({ ...formData, is_self_employed: !formData.is_self_employed })}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.selfEmployedTitle}>I'm self-employed</Text>
              <Text style={styles.selfEmployedDesc}>You act as both the business and service provider</Text>
            </View>
            <View style={[styles.toggleCircle, formData.is_self_employed && styles.toggleCircleActive]}>
              {formData.is_self_employed && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
          </TouchableOpacity>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {formData.is_self_employed ? 'Your Business Name' : 'Where do you work?'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={formData.is_self_employed ? "e.g. Jane's Salon" : 'e.g. Sterling Dermatology'}
              placeholderTextColor="#94A3B8"
              value={formData.business_name}
              onChangeText={t => setFormData({ ...formData, business_name: t })}
            />
          </View>

          {formData.is_self_employed && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Industry</Text>
              <TouchableOpacity style={styles.dropdownInput} onPress={() => setIndustryModalVisible(true)}>
                <Text style={[styles.dropdownValue, !formData.industry && { color: '#94A3B8' }]}>
                  {formData.industry || 'Select Industry'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Job Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Senior Stylist"
              placeholderTextColor="#94A3B8"
              value={formData.job_title}
              onChangeText={t => setFormData({ ...formData, job_title: t })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Services You Offer</Text>
            <View style={styles.tagInputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="e.g. Haircut, Coloring..."
                placeholderTextColor="#94A3B8"
                value={serviceInput}
                onChangeText={setServiceInput}
                onSubmitEditing={addService}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.addTagBtn} onPress={addService}>
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {formData.services.length > 0 && (
              <View style={styles.tagChipsRow}>
                {formData.services.map(service => (
                  <View key={service} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>{service}</Text>
                    <TouchableOpacity onPress={() => removeService(service)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={18} color={theme.colors.secondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio <Text style={styles.optionalLabel}>(Optional)</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell clients about yourself and your experience..."
              placeholderTextColor="#94A3B8"
              value={formData.bio}
              onChangeText={t => setFormData({ ...formData, bio: t })}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {renderSubmitButton()}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderScheduleStep = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {renderStepHeader('Your Schedule', 'Clients will see when you\'re available or busy.')}

        <View style={styles.form}>
          <View style={styles.scheduleCard}>
            <Text style={styles.label}>What days do you work?</Text>
            <View style={styles.daySelectorGrid}>
              {DAYS.map((day, idx) => {
                const isSelected = formData.selected_days.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayCircle, isSelected && styles.dayCircleActive]}
                    onPress={() => toggleDay(day)}
                  >
                    <Text style={[styles.dayCircleText, isSelected && styles.dayCircleTextActive]}>
                      {DAYS_SHORT[idx]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {formData.selected_days.length > 0 && (
              <View style={styles.perDaySection}>
                <View style={styles.divider} />
                <Text style={styles.label}>Set Hours Per Day</Text>
                {formData.selected_days.map(day => (
                  <View key={day} style={styles.dayTimingRow}>
                    <Text style={styles.dayTimingLabel}>{day}</Text>
                    <View style={[styles.row, { flex: 2, gap: 8 }]}>
                      <TouchableOpacity style={styles.timeSelectBtn} onPress={() => openTimePicker(day, 'start')}>
                        <Text style={styles.timeSelectText}>
                          {formData.day_timings[day]?.start || '09:00 AM'}
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.timeSeparator}>
                        <Text style={styles.timeSeparatorText}>to</Text>
                      </View>
                      <TouchableOpacity style={styles.timeSelectBtn} onPress={() => openTimePicker(day, 'end')}>
                        <Text style={styles.timeSelectText}>
                          {formData.day_timings[day]?.end || '05:00 PM'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {renderSubmitButton()}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderBusinessStep = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {renderStepHeader('Your Business', 'Set up your business profile so employees can be added under you.')}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Business Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sterling Dermatology"
              placeholderTextColor="#94A3B8"
              value={formData.business_name}
              onChangeText={t => setFormData({ ...formData, business_name: t })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Industry</Text>
            <TouchableOpacity style={styles.dropdownInput} onPress={() => setIndustryModalVisible(true)}>
              <Text style={[styles.dropdownValue, !formData.industry && { color: '#94A3B8' }]}>
                {formData.industry || 'Select Industry'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Description <Text style={styles.optionalLabel}>(Optional)</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your business and the services you offer..."
              placeholderTextColor="#94A3B8"
              value={formData.business_description}
              onChangeText={t => setFormData({ ...formData, business_description: t })}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Location <Text style={styles.optionalLabel}>(Optional)</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 123 Main St, New York, NY"
              placeholderTextColor="#94A3B8"
              value={formData.location}
              onChangeText={t => setFormData({ ...formData, location: t })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Website <Text style={styles.optionalLabel}>(Optional)</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="https://yourbusiness.com"
              placeholderTextColor="#94A3B8"
              value={formData.website}
              onChangeText={t => setFormData({ ...formData, website: t })}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          {renderSubmitButton()}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderInterestsStep = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {renderStepHeader('What interests you?', 'Select categories to personalize your experience.')}

      <View style={styles.interestsGrid}>
        {SERVICE_CATEGORIES.map(cat => {
          const selected = formData.interests.includes(cat.id);
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.interestCard, selected && styles.interestCardActive]}
              onPress={() => toggleInterest(cat.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={cat.icon}
                size={28}
                color={selected ? theme.colors.secondary : theme.colors.textSecondary}
              />
              <Text style={[styles.interestLabel, selected && styles.interestLabelActive]}>
                {cat.label}
              </Text>
              {selected && (
                <View style={styles.interestCheckBadge}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ paddingHorizontal: 0, marginTop: 24 }}>
        {renderSubmitButton()}
      </View>
    </ScrollView>
  );

  // ── Modals ──────────────────────────────────────────────

  const renderAgeModal = () => {
    const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / ITEM_HEIGHT);
      const age = AGES[index + 2];
      if (age && age !== scrolledAge && age !== '') setScrolledAge(age);
    };

    return (
      <Modal visible={ageModalVisible} animationType="slide" transparent={false} onRequestClose={() => setAgeModalVisible(false)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <View style={styles.ageHeader}>
              <Text style={styles.ageTitle}>What is your age?</Text>
              <Text style={styles.ageSubtitle}>This helps us personalize your experience.</Text>
            </View>

            <View style={[styles.pickerContainer, { width: '100%', height: ITEM_HEIGHT * 5 }]}>
              <View style={styles.selectionIndicator} />
              <FlatList
                data={AGES}
                keyExtractor={(_, index) => index.toString()}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                onScroll={onScroll}
                scrollEventThrottle={16}
                renderItem={({ item }) => (
                  <View style={[styles.ageItem, { height: ITEM_HEIGHT, width: '100%' }]}>
                    <Text style={[styles.ageItemText, item === scrolledAge && styles.ageItemTextSelected]}>
                      {item}
                    </Text>
                  </View>
                )}
                getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                initialScrollIndex={15}
              />
            </View>

            <View style={styles.ageFooter}>
              <TouchableOpacity onPress={() => setAgeModalVisible(false)} style={{ padding: 10 }}>
                <Text style={styles.ageFooterLink}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nextCircleBtn}
                onPress={() => {
                  setFormData({ ...formData, age: scrolledAge });
                  setAgeModalVisible(false);
                }}
              >
                <Ionicons name="checkmark" size={32} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    );
  };

  const renderGenderModal = () => (
    <Modal visible={genderModalVisible} animationType="slide" transparent onRequestClose={() => setGenderModalVisible(false)}>
      <View style={styles.pickerOverlay}>
        <TouchableOpacity activeOpacity={1} style={styles.pickerBackdrop} onPress={() => setGenderModalVisible(false)} />
        <View style={styles.pickerContent}>
          <View style={styles.pickerHandle} />
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Gender</Text>
            <TouchableOpacity onPress={() => setGenderModalVisible(false)}>
              <Ionicons name="close-circle" size={28} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {['Male', 'Female', 'Other'].map(option => (
            <TouchableOpacity
              key={option}
              style={styles.pickerOption}
              onPress={() => {
                setFormData({ ...formData, gender: option });
                setGenderModalVisible(false);
              }}
            >
              <Text style={[styles.pickerOptionText, formData.gender === option && styles.pickerOptionTextActive]}>
                {option}
              </Text>
              {formData.gender === option && <Ionicons name="checkmark-circle" size={22} color={theme.colors.secondary} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );

  const renderIndustryModal = () => (
    <Modal visible={industryModalVisible} animationType="slide" transparent onRequestClose={() => setIndustryModalVisible(false)}>
      <View style={styles.pickerOverlay}>
        <TouchableOpacity activeOpacity={1} style={styles.pickerBackdrop} onPress={() => setIndustryModalVisible(false)} />
        <View style={[styles.pickerContent, { maxHeight: '60%' }]}>
          <View style={styles.pickerHandle} />
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Industry</Text>
            <TouchableOpacity onPress={() => setIndustryModalVisible(false)}>
              <Ionicons name="close-circle" size={28} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {INDUSTRIES.map(option => (
              <TouchableOpacity
                key={option}
                style={styles.pickerOption}
                onPress={() => {
                  setFormData({ ...formData, industry: option });
                  setIndustryModalVisible(false);
                }}
              >
                <Text style={[styles.pickerOptionText, formData.industry === option && styles.pickerOptionTextActive]}>
                  {option}
                </Text>
                {formData.industry === option && <Ionicons name="checkmark-circle" size={22} color={theme.colors.secondary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderTimePickerModal = () => {
    const onScrollHour = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / PICKER_ITEM_HEIGHT);
      const val = HOURS_WHEEL[index + 2];
      if (val && val !== tempTime.hour && val !== '') setTempTime(prev => ({ ...prev, hour: val }));
    };
    const onScrollMinute = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / PICKER_ITEM_HEIGHT);
      const val = MINUTES_WHEEL[index + 2];
      if (val && val !== tempTime.minute && val !== '') setTempTime(prev => ({ ...prev, minute: val }));
    };
    const onScrollAMPM = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / PICKER_ITEM_HEIGHT);
      const val = AMPM_WHEEL[index + 2];
      if (val && val !== tempTime.ampm && val !== '') setTempTime(prev => ({ ...prev, ampm: val }));
    };

    return (
      <Modal visible={timePickerVisible} animationType="slide" transparent onRequestClose={() => setTimePickerVisible(false)}>
        <View style={styles.pickerOverlay}>
          <TouchableOpacity activeOpacity={1} style={styles.pickerBackdrop} onPress={() => setTimePickerVisible(false)} />
          <View style={[styles.pickerContent, { height: 420 }]}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <View>
                <Text style={styles.pickerTitle}>{activeTimeType === 'start' ? 'Start' : 'End'} Time</Text>
                <Text style={styles.pickerSubtitle}>{activeDay}</Text>
              </View>
              <TouchableOpacity onPress={closeTimePicker} style={styles.doneBtn}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.wheelsContainer}>
              <View style={styles.wheelIndicator} />

              <View style={styles.wheelColumn}>
                <FlatList
                  data={HOURS_WHEEL}
                  keyExtractor={(_, i) => `h-${i}`}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={PICKER_ITEM_HEIGHT}
                  onScroll={onScrollHour}
                  scrollEventThrottle={16}
                  decelerationRate="fast"
                  renderItem={({ item }) => (
                    <View style={[styles.wheelItem, { height: PICKER_ITEM_HEIGHT }]}>
                      <Text style={[styles.wheelItemText, tempTime.hour === item && styles.wheelItemTextSelected]}>
                        {item}
                      </Text>
                    </View>
                  )}
                  initialScrollIndex={Math.max(0, HOURS_WHEEL.indexOf(tempTime.hour) - 2)}
                  getItemLayout={(_, index) => ({ length: PICKER_ITEM_HEIGHT, offset: PICKER_ITEM_HEIGHT * index, index })}
                />
              </View>

              <Text style={styles.wheelSeparator}>:</Text>

              <View style={styles.wheelColumn}>
                <FlatList
                  data={MINUTES_WHEEL}
                  keyExtractor={(_, i) => `m-${i}`}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={PICKER_ITEM_HEIGHT}
                  onScroll={onScrollMinute}
                  scrollEventThrottle={16}
                  decelerationRate="fast"
                  renderItem={({ item }) => (
                    <View style={[styles.wheelItem, { height: PICKER_ITEM_HEIGHT }]}>
                      <Text style={[styles.wheelItemText, tempTime.minute === item && styles.wheelItemTextSelected]}>
                        {item}
                      </Text>
                    </View>
                  )}
                  initialScrollIndex={Math.max(0, MINUTES_WHEEL.indexOf(tempTime.minute) - 2)}
                  getItemLayout={(_, index) => ({ length: PICKER_ITEM_HEIGHT, offset: PICKER_ITEM_HEIGHT * index, index })}
                />
              </View>

              <View style={[styles.wheelColumn, { flex: 0.6 }]}>
                <FlatList
                  data={AMPM_WHEEL}
                  keyExtractor={(_, i) => `a-${i}`}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={PICKER_ITEM_HEIGHT}
                  onScroll={onScrollAMPM}
                  scrollEventThrottle={16}
                  decelerationRate="fast"
                  renderItem={({ item }) => (
                    <View style={[styles.wheelItem, { height: PICKER_ITEM_HEIGHT }]}>
                      <Text style={[styles.wheelItemText, tempTime.ampm === item && styles.wheelItemTextSelected]}>
                        {item}
                      </Text>
                    </View>
                  )}
                  initialScrollIndex={Math.max(0, AMPM_WHEEL.indexOf(tempTime.ampm) - 2)}
                  getItemLayout={(_, index) => ({ length: PICKER_ITEM_HEIGHT, offset: PICKER_ITEM_HEIGHT * index, index })}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // ── Main Render ─────────────────────────────────────────

  if (loading && step === 'role') {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {step !== 'role' && selectedRole && (
        <View style={styles.progressWrapper}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${totalSteps > 1 ? (stepIdx / (totalSteps - 1)) * 100 : 0}%` },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            Step {stepIdx + 1} of {totalSteps}
          </Text>
        </View>
      )}

      {step === 'role' && renderRoleStep()}
      {step === 'profile' && renderProfileStep()}
      {step === 'work' && renderWorkStep()}
      {step === 'business' && renderBusinessStep()}
      {step === 'schedule' && renderScheduleStep()}
      {step === 'interests' && renderInterestsStep()}

      {renderAgeModal()}
      {renderGenderModal()}
      {renderIndustryModal()}
      {renderTimePickerModal()}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },

  // Progress
  progressWrapper: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.secondary,
    borderRadius: 2,
  },
  progressLabel: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },

  // Header
  header: {
    marginBottom: 32,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  welcomeLabel: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: 13,
    color: theme.colors.secondary,
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: 32,
    color: theme.colors.textPrimary,
    marginBottom: 12,
    lineHeight: 40,
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 24,
  },

  // Role Cards
  roleCards: {
    gap: 16,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  roleIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  roleCardContent: {
    flex: 1,
  },
  roleCardTitle: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  roleCardDesc: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },

  // Form
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  label: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginLeft: 4,
  },
  optionalLabel: {
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
  },
  input: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    color: theme.colors.textPrimary,
  },
  textArea: {
    height: 110,
    paddingTop: 16,
    textAlignVertical: 'top',
  },
  dropdownInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    height: 54,
  },
  dropdownValue: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },

  // Self-Employed Toggle
  selfEmployedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  selfEmployedCardActive: {
    borderColor: theme.colors.secondary,
    backgroundColor: '#EFF6FF',
  },
  selfEmployedTitle: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  selfEmployedDesc: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  toggleCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleCircleActive: {
    backgroundColor: theme.colors.secondary,
    borderColor: theme.colors.secondary,
  },

  // Tag Input (Services)
  tagInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addTagBtn: {
    width: 54,
    height: 54,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  tagChipText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: 14,
    color: theme.colors.secondary,
  },

  // Interests Grid
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  interestCard: {
    width: INTEREST_CARD_WIDTH,
    paddingVertical: 20,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    gap: 10,
    position: 'relative',
  },
  interestCardActive: {
    borderColor: theme.colors.secondary,
    backgroundColor: '#EFF6FF',
  },
  interestLabel: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  interestLabelActive: {
    color: theme.colors.secondary,
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  interestCheckBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Schedule
  scheduleCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
  },
  daySelectorGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dayCircleActive: {
    backgroundColor: theme.colors.secondary,
    borderColor: theme.colors.secondary,
  },
  dayCircleText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  dayCircleTextActive: {
    color: '#fff',
    fontFamily: theme.typography.fontFamily.bold,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 20,
  },
  perDaySection: {
    marginTop: 4,
  },
  dayTimingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  dayTimingLabel: {
    flex: 0.7,
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  timeSelectBtn: {
    flex: 1.2,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSelectText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  timeSeparator: {
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  timeSeparatorText: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },

  // Submit Button
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    padding: 18,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: 16,
    color: '#fff',
  },

  // Age Picker Modal
  ageHeader: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 60,
  },
  ageTitle: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: 28,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  ageSubtitle: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  pickerContainer: {
    height: 400,
    position: 'relative',
    justifyContent: 'center',
  },
  selectionIndicator: {
    position: 'absolute',
    top: '50%',
    left: 20,
    right: 20,
    height: ITEM_HEIGHT,
    marginTop: -ITEM_HEIGHT / 2,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
  },
  ageItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ageItemText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: 24,
    color: '#94A3B8',
  },
  ageItemTextSelected: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: 44,
    color: theme.colors.secondary,
  },
  ageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 'auto',
    marginBottom: 40,
  },
  ageFooterLink: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  nextCircleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },

  // Bottom Sheet Pickers
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  pickerContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  pickerHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  pickerTitle: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: 20,
    color: theme.colors.textPrimary,
  },
  pickerSubtitle: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  pickerOptionText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  pickerOptionTextActive: {
    color: theme.colors.secondary,
    fontFamily: theme.typography.fontFamily.bold,
  },
  doneBtn: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
  },
  doneBtnText: {
    color: theme.colors.bubbleSentText,
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: 14,
  },

  // Time Picker Wheels
  wheelsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: PICKER_ITEM_HEIGHT * 5,
    position: 'relative',
    marginTop: 20,
  },
  wheelColumn: {
    flex: 1,
    height: '100%',
  },
  wheelSeparator: {
    fontSize: 24,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginHorizontal: 10,
  },
  wheelItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelItemText: {
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.medium,
    color: '#94A3B8',
  },
  wheelItemTextSelected: {
    fontSize: 24,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.secondary,
  },
  wheelIndicator: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: PICKER_ITEM_HEIGHT,
    marginTop: -PICKER_ITEM_HEIGHT / 2,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    zIndex: -1,
  },
  });
}