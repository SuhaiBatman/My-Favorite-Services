import { supabase } from './supabase';

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
