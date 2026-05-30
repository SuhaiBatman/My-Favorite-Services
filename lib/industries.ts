export const OTHER_INDUSTRY = 'Other';

export const PRESET_INDUSTRIES = [
  'Healthcare',
  'Beauty & Wellness',
  'Fitness & Sports',
  'Food & Dining',
  'Education',
  'Technology',
  'Legal',
  'Finance',
  'Real Estate',
  'Home Services',
  'Automotive',
  'Creative & Design',
  'Consulting',
  'Pet Services',
  'Events & Entertainment',
  OTHER_INDUSTRY,
] as const;

const PRESET_SET = new Set<string>(PRESET_INDUSTRIES);

export function isPresetIndustry(value: string): boolean {
  return PRESET_SET.has(value);
}

export function normalizeCustomIndustry(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function buildIndustryOptions(customIndustries: string[]): string[] {
  const presets = PRESET_INDUSTRIES.filter(i => i !== OTHER_INDUSTRY);
  const extras = customIndustries
    .map(normalizeCustomIndustry)
    .filter(
      (entry, index, list) =>
        entry.length > 0 &&
        entry !== OTHER_INDUSTRY &&
        !presets.includes(entry) &&
        list.indexOf(entry) === index
    );
  return [...presets, ...extras, OTHER_INDUSTRY];
}

export function customIndustriesForValue(industry: string): string[] {
  const normalized = normalizeCustomIndustry(industry);
  if (!normalized || isPresetIndustry(normalized)) return [];
  return [normalized];
}

export function mergeCustomIndustries(
  existing: string[] | undefined,
  industry: string
): string[] {
  return [...new Set([...(existing ?? []), ...customIndustriesForValue(industry)])];
}
