import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export type OnboardingRole = 'user' | 'employee' | 'business';
export type OnboardingStep =
  | 'role'
  | 'profile'
  | 'work'
  | 'business'
  | 'schedule'
  | 'interests';

export type OnboardingFormDraft = {
  first_name: string;
  last_name: string;
  middle_initial: string;
  age: string;
  gender: string;
  phone: string;
  email: string;
  is_self_employed: boolean;
  job_title: string;
  services: string[];
  bio: string;
  business_name: string;
  industry: string;
  /** User-defined industries entered via "Other" */
  custom_industries: string[];
  business_description: string;
  website: string;
  location: string;
  selected_days: string[];
  day_timings: Record<string, { start: string; end: string }>;
  flexible_hours: boolean;
  interests: string[];
  /** User-defined interests entered via "Other" on the interests step */
  custom_interests: string[];
};

export type OnboardingProgress = {
  step: OnboardingStep;
  selectedRole: OnboardingRole | null;
  formData: OnboardingFormDraft;
};

const STEPS_FOR_ROLE: Record<OnboardingRole, OnboardingStep[]> = {
  user: ['role', 'profile', 'interests'],
  employee: ['role', 'profile', 'work', 'schedule', 'interests'],
  business: ['role', 'profile', 'business'],
};

function progressKey(userId: string) {
  return `@onboarding/progress:${userId}`;
}

export function normalizeOnboardingStep(
  role: OnboardingRole | null,
  step: OnboardingStep
): OnboardingStep {
  if (!role) return 'role';
  const steps = STEPS_FOR_ROLE[role];
  return steps.includes(step) ? step : steps[1] ?? 'profile';
}

export async function loadOnboardingProgress(
  userId: string
): Promise<OnboardingProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(progressKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingProgress;
    if (!parsed?.step || !parsed.formData) return null;
    return {
      step: normalizeOnboardingStep(parsed.selectedRole, parsed.step),
      selectedRole: parsed.selectedRole ?? null,
      formData: {
        ...parsed.formData,
        flexible_hours: Boolean(parsed.formData.flexible_hours),
      },
    };
  } catch {
    return null;
  }
}

export async function saveOnboardingProgress(
  userId: string,
  progress: OnboardingProgress
): Promise<void> {
  try {
    await AsyncStorage.setItem(progressKey(userId), JSON.stringify(progress));
  } catch {
    // Best-effort local draft
  }
}

export async function clearOnboardingProgress(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(progressKey(userId));
  } catch {
    // Best-effort cleanup
  }
}

type DayTiming = { start: string; end: string };

const DAY_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function toMinutes(time12: string): number {
  const [time, meridiemRaw] = time12.split(' ');
  const [hourRaw, minuteRaw] = time.split(':');
  const meridiem = meridiemRaw?.toUpperCase();
  let hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  return hour * 60 + minute;
}

export async function persistEmployeeStructuredData(
  employeeId: string,
  services: string[],
  selectedDays: string[],
  dayTimings: Record<string, DayTiming>
) {
  const normalizedServices = services
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({
      employee_id: employeeId,
      name,
      name_normalized: name.toLowerCase(),
    }));

  const availability = selectedDays
    .map((day) => {
      const idx = DAY_TO_INDEX[day.toLowerCase()];
      if (typeof idx !== 'number') return null;
      const start = dayTimings[day]?.start ?? '09:00 AM';
      const end = dayTimings[day]?.end ?? '05:00 PM';
      return {
        employee_id: employeeId,
        day_of_week: idx,
        start_minutes: toMinutes(start),
        end_minutes: toMinutes(end),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const { error: clearServicesError } = await supabase
    .from('employee_services')
    .delete()
    .eq('employee_id', employeeId);
  if (clearServicesError) throw clearServicesError;

  if (normalizedServices.length > 0) {
    const { error: addServicesError } = await supabase
      .from('employee_services')
      .insert(normalizedServices);
    if (addServicesError) throw addServicesError;
  }

  const { error: clearAvailabilityError } = await supabase
    .from('employee_availability')
    .delete()
    .eq('employee_id', employeeId);
  if (clearAvailabilityError) throw clearAvailabilityError;

  if (availability.length > 0) {
    const { error: addAvailabilityError } = await supabase
      .from('employee_availability')
      .insert(availability);
    if (addAvailabilityError) throw addAvailabilityError;
  }
}
