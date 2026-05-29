import type { ProviderAvailabilitySlot } from './providerProfile';

export const SCHEDULE_DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const SCHEDULE_DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const INDEX_TO_DAY: Record<number, (typeof SCHEDULE_DAYS)[number]> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

export type DayTiming = { start: string; end: string };

export function minutesToTime12(minutes: number): string {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
}

export function slotsToSchedule(slots: ProviderAvailabilitySlot[]): {
  selectedDays: string[];
  dayTimings: Record<string, DayTiming>;
} {
  const dayTimings: Record<string, DayTiming> = {};
  const selectedDays: string[] = [];
  const sorted = [...slots].sort((a, b) => a.day_of_week - b.day_of_week);

  for (const slot of sorted) {
    const day = INDEX_TO_DAY[slot.day_of_week];
    if (!day) continue;
    selectedDays.push(day);
    dayTimings[day] = {
      start: minutesToTime12(slot.start_minutes),
      end: minutesToTime12(slot.end_minutes),
    };
  }

  return { selectedDays, dayTimings };
}

export function buildScheduleProfileFields(
  selectedDays: string[],
  dayTimings: Record<string, DayTiming>
): { work_days: string; timings: string } {
  if (selectedDays.length === 0) {
    return { work_days: '', timings: '' };
  }

  const work_days = selectedDays.join(', ');
  const timings = selectedDays
    .map((day) => {
      const start = dayTimings[day]?.start ?? '09:00 AM';
      const end = dayTimings[day]?.end ?? '05:00 PM';
      return `${day.substring(0, 3)}: ${start} - ${end}`;
    })
    .join(', ');

  return { work_days, timings };
}
