import { supabase } from './supabase';

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export type AppointmentParticipant = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  job_title?: string | null;
  business_name?: string | null;
  location?: string | null;
};

export type Appointment = {
  id: string;
  user_id: string;
  provider_id: string;
  service_name: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  location: string | null;
  notes: string | null;
  provider?: AppointmentParticipant | null;
  user?: AppointmentParticipant | null;
};

const APPOINTMENT_SELECT = `
  id,
  user_id,
  provider_id,
  service_name,
  starts_at,
  ends_at,
  status,
  location,
  notes,
  provider:provider_id (
    id,
    first_name,
    last_name,
    job_title,
    business_name,
    location
  )
`;

const PROVIDER_APPOINTMENT_SELECT = `
  ${APPOINTMENT_SELECT},
  user:user_id (
    id,
    first_name,
    last_name
  )
`;

function normalizeParticipant<T extends AppointmentParticipant | null>(
  value: T | T[] | (T | null | undefined)[] | null | undefined
): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeAppointment(row: Appointment): Appointment {
  return {
    ...row,
    provider: normalizeParticipant(row.provider as Appointment['provider'] | Appointment['provider'][] | null),
    user: normalizeParticipant(row.user as Appointment['user'] | Appointment['user'][] | null),
  };
}

export async function listUserUpcomingAppointments(userId: string): Promise<Appointment[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('appointments')
    .select(APPOINTMENT_SELECT)
    .eq('user_id', userId)
    .gte('starts_at', now)
    .neq('status', 'cancelled')
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => normalizeAppointment(row as unknown as Appointment));
}

export async function listProviderUpcomingAppointments(
  providerId: string
): Promise<Appointment[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('appointments')
    .select(PROVIDER_APPOINTMENT_SELECT)
    .eq('provider_id', providerId)
    .gte('starts_at', now)
    .neq('status', 'cancelled')
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => normalizeAppointment(row as unknown as Appointment));
}

export async function listProviderAppointmentsBetween(
  providerId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(PROVIDER_APPOINTMENT_SELECT)
    .eq('provider_id', providerId)
    .lt('starts_at', rangeEnd.toISOString())
    .gt('ends_at', rangeStart.toISOString())
    .neq('status', 'cancelled')
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => normalizeAppointment(row as unknown as Appointment));
}

export async function listAppointmentsInRange(
  participantId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<{ asProvider: Appointment[]; asClient: Appointment[] }> {
  const startIso = rangeStart.toISOString();
  const endIso = rangeEnd.toISOString();

  const [providerRes, clientRes] = await Promise.all([
    supabase
      .from('appointments')
      .select(PROVIDER_APPOINTMENT_SELECT)
      .eq('provider_id', participantId)
      .gte('starts_at', startIso)
      .lte('starts_at', endIso)
      .neq('status', 'cancelled')
      .order('starts_at', { ascending: true }),
    supabase
      .from('appointments')
      .select(APPOINTMENT_SELECT)
      .eq('user_id', participantId)
      .gte('starts_at', startIso)
      .lte('starts_at', endIso)
      .neq('status', 'cancelled')
      .order('starts_at', { ascending: true }),
  ]);

  if (providerRes.error) throw providerRes.error;
  if (clientRes.error) throw clientRes.error;

  return {
    asProvider: (providerRes.data ?? []).map((row) =>
      normalizeAppointment(row as unknown as Appointment)
    ),
    asClient: (clientRes.data ?? []).map((row) =>
      normalizeAppointment(row as unknown as Appointment)
    ),
  };
}

export async function respondToAppointmentAsProvider(
  appointmentId: string,
  decision: 'confirmed' | 'cancelled'
): Promise<Appointment> {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status: decision })
    .eq('id', appointmentId)
    .eq('status', 'pending')
    .select(PROVIDER_APPOINTMENT_SELECT)
    .single();

  if (error) throw error;
  return normalizeAppointment(data as unknown as Appointment);
}

export type CreateAppointmentInput = {
  userId: string;
  providerId: string;
  serviceName: string;
  startsAt: Date;
  endsAt: Date;
  status?: AppointmentStatus;
  location?: string | null;
  notes?: string | null;
};

export async function createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      user_id: input.userId,
      provider_id: input.providerId,
      service_name: input.serviceName,
      starts_at: input.startsAt.toISOString(),
      ends_at: input.endsAt.toISOString(),
      status: input.status ?? 'confirmed',
      location: input.location ?? null,
      notes: input.notes ?? null,
    })
    .select(APPOINTMENT_SELECT)
    .single();

  if (error) throw error;
  return normalizeAppointment(data as unknown as Appointment);
}

export async function getAppointment(id: string): Promise<Appointment | null> {
  const { data, error } = await supabase
    .from('appointments')
    .select(PROVIDER_APPOINTMENT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return normalizeAppointment(data as unknown as Appointment);
}
