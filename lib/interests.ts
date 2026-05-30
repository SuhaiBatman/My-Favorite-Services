import type { Ionicons } from '@expo/vector-icons';
import { isPresetIndustry, normalizeCustomIndustry } from './industries';

export const OTHER_INTEREST = '__other__';

export type InterestOption = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  isOther?: boolean;
};

export const PRESET_INTEREST_CATEGORIES: InterestOption[] = [
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

const PRESET_INTEREST_IDS = new Set(PRESET_INTEREST_CATEGORIES.map(c => c.id));

const INDUSTRY_TO_INTEREST_ID: Record<string, string> = {
  Healthcare: 'healthcare',
  'Beauty & Wellness': 'beauty',
  'Fitness & Sports': 'fitness',
  'Food & Dining': 'food',
  Education: 'education',
  Legal: 'legal',
  Finance: 'finance',
  'Home Services': 'home',
  Automotive: 'auto',
  'Creative & Design': 'creative',
  'Pet Services': 'pets',
  'Events & Entertainment': 'events',
};

export function isPresetInterestId(id: string): boolean {
  return PRESET_INTEREST_IDS.has(id);
}

export function customInterestsFromValues(values: string[]): string[] {
  return values
    .map(normalizeCustomIndustry)
    .filter(
      (entry, index, list) =>
        entry.length > 0 &&
        entry !== OTHER_INTEREST &&
        !isPresetInterestId(entry) &&
        !isPresetIndustry(entry) &&
        list.indexOf(entry) === index
    );
}

export function mergeCustomInterests(
  existing: string[] | undefined,
  interests: string[]
): string[] {
  return [
    ...new Set([...(existing ?? []), ...customInterestsFromValues(interests)]),
  ];
}

export function buildInterestOptions(
  customIndustries: string[],
  customInterests: string[]
): InterestOption[] {
  const presets = [...PRESET_INTEREST_CATEGORIES];
  const seenIds = new Set(presets.map(c => c.id));
  const extras: InterestOption[] = [];

  const addExtra = (raw: string) => {
    const normalized = normalizeCustomIndustry(raw);
    if (!normalized) return;

    const mappedId = INDUSTRY_TO_INTEREST_ID[normalized];
    if (mappedId && seenIds.has(mappedId)) return;

    const id = mappedId ?? normalized;
    if (seenIds.has(id)) return;

    seenIds.add(id);
    extras.push({
      id,
      label: mappedId
        ? (PRESET_INTEREST_CATEGORIES.find(c => c.id === mappedId)?.label ?? normalized)
        : normalized,
      icon: 'briefcase-outline',
    });
  };

  for (const industry of customIndustries) addExtra(industry);
  for (const interest of customInterests) addExtra(interest);

  return [
    ...presets,
    ...extras,
    {
      id: OTHER_INTEREST,
      label: 'Other',
      icon: 'add-circle-outline',
      isOther: true,
    },
  ];
}
