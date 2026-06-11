import { supabase } from './supabase';
import type { ProviderAvailabilitySlot } from './profileSchedule';
import type { ServiceOffer } from './serviceOffer';

export type EmployeeService = {
  id: string;
  employee_id: string;
  name: string;
  durationMinutes: number | null;
  priceCents: number | null;
};

export async function listEmployeeAvailability(
  employeeId: string
): Promise<ProviderAvailabilitySlot[]> {
  const { data, error } = await supabase
    .from('employee_availability')
    .select('day_of_week, start_minutes, end_minutes')
    .eq('employee_id', employeeId)
    .order('day_of_week', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    day_of_week: row.day_of_week,
    start_minutes: row.start_minutes,
    end_minutes: row.end_minutes,
  }));
}

export async function listEmployeeServices(employeeId: string): Promise<EmployeeService[]> {
  const { data, error } = await supabase
    .from('employee_services')
    .select('id, employee_id, name, duration_minutes, price_cents')
    .eq('employee_id', employeeId)
    .order('name', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    employee_id: row.employee_id,
    name: row.name,
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
  }));
}

export async function listEmployeeServiceOffers(employeeId: string): Promise<ServiceOffer[]> {
  const services = await listEmployeeServices(employeeId);
  return services.map((service) => ({
    name: service.name,
    durationMinutes: service.durationMinutes ?? 0,
    priceCents: service.priceCents ?? 0,
  }));
}
