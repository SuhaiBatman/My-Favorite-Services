import type { Appointment } from './appointments';
import { localDateKey, localDateKeyFromIso } from './format';

export type ScheduleDayMarker = 'provider' | 'client' | 'both';

export type ScheduleDayMarkers = Record<string, ScheduleDayMarker>;

export type SchedulePendingDays = Set<string>;

export function buildScheduleMarkers(
  asProvider: Appointment[],
  asClient: Appointment[],
  employeeId: string
): { markers: ScheduleDayMarkers; pendingDays: SchedulePendingDays } {
  const providerDays = new Set<string>();
  const clientDays = new Set<string>();
  const pendingDays: SchedulePendingDays = new Set();

  for (const appt of asProvider) {
    if (appt.provider_id !== employeeId) continue;
    const key = localDateKeyFromIso(appt.starts_at);
    providerDays.add(key);
    if (appt.status === 'pending') {
      pendingDays.add(key);
    }
  }

  for (const appt of asClient) {
    if (appt.user_id !== employeeId) continue;
    clientDays.add(localDateKeyFromIso(appt.starts_at));
  }

  const markers: ScheduleDayMarkers = {};
  const allDays = new Set([...providerDays, ...clientDays]);
  for (const day of allDays) {
    const hasProvider = providerDays.has(day);
    const hasClient = clientDays.has(day);
    if (hasProvider && hasClient) markers[day] = 'both';
    else if (hasProvider) markers[day] = 'provider';
    else markers[day] = 'client';
  }

  return { markers, pendingDays };
}

export function appointmentsOnLocalDay(
  appointments: Appointment[],
  day: Date
): Appointment[] {
  const key = localDateKey(day);
  return appointments.filter((a) => localDateKeyFromIso(a.starts_at) === key);
}
