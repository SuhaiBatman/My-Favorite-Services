import { supabase } from './supabase';
import { subscribeToTableChanges } from './realtimeSubscribe';

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
  reschedule_starts_at: string | null;
  reschedule_ends_at: string | null;
  reschedule_requested_by: string | null;
  provider?: AppointmentParticipant | null;
  user?: AppointmentParticipant | null;
};

export function hasPendingReschedule(appointment: Appointment): boolean {
  return Boolean(appointment.reschedule_starts_at && appointment.reschedule_ends_at);
}

export function isRescheduleAwaitingResponse(
  appointment: Appointment,
  viewerId: string
): boolean {
  return (
    hasPendingReschedule(appointment) &&
    Boolean(appointment.reschedule_requested_by) &&
    appointment.reschedule_requested_by !== viewerId
  );
}

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
  reschedule_starts_at,
  reschedule_ends_at,
  reschedule_requested_by,
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
    reschedule_starts_at: row.reschedule_starts_at ?? null,
    reschedule_ends_at: row.reschedule_ends_at ?? null,
    reschedule_requested_by: row.reschedule_requested_by ?? null,
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

export async function listUserUpcomingWithProvider(
  userId: string,
  providerId: string
): Promise<Appointment[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('appointments')
    .select(APPOINTMENT_SELECT)
    .eq('user_id', userId)
    .eq('provider_id', providerId)
    .gte('starts_at', now)
    .neq('status', 'cancelled')
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => normalizeAppointment(row as unknown as Appointment));
}

export type RescheduleAppointmentInput = {
  appointmentId: string;
  startsAt: Date;
  endsAt: Date;
  requestedById: string;
};

export async function requestAppointmentReschedule(
  input: RescheduleAppointmentInput
): Promise<Appointment> {
  const { data, error } = await supabase
    .from('appointments')
    .update({
      reschedule_starts_at: input.startsAt.toISOString(),
      reschedule_ends_at: input.endsAt.toISOString(),
      reschedule_requested_by: input.requestedById,
    })
    .eq('id', input.appointmentId)
    .eq('status', 'confirmed')
    .is('reschedule_starts_at', null)
    .select(PROVIDER_APPOINTMENT_SELECT)
    .single();

  if (error) throw error;
  return normalizeAppointment(data as unknown as Appointment);
}

export async function respondToReschedule(
  appointmentId: string,
  decision: 'confirmed' | 'cancelled'
): Promise<Appointment> {
  const existing = await getAppointment(appointmentId);
  if (!existing?.reschedule_starts_at || !existing.reschedule_ends_at) {
    throw new Error('No pending reschedule');
  }

  if (decision === 'confirmed') {
    const { data, error } = await supabase
      .from('appointments')
      .update({
        starts_at: existing.reschedule_starts_at,
        ends_at: existing.reschedule_ends_at,
        reschedule_starts_at: null,
        reschedule_ends_at: null,
        reschedule_requested_by: null,
        status: 'confirmed',
      })
      .eq('id', appointmentId)
      .select(PROVIDER_APPOINTMENT_SELECT)
      .single();

    if (error) throw error;
    return normalizeAppointment(data as unknown as Appointment);
  }

  const { data, error } = await supabase
    .from('appointments')
    .update({
      reschedule_starts_at: null,
      reschedule_ends_at: null,
      reschedule_requested_by: null,
    })
    .eq('id', appointmentId)
    .select(PROVIDER_APPOINTMENT_SELECT)
    .single();

  if (error) throw error;
  return normalizeAppointment(data as unknown as Appointment);
}

/** @deprecated Use respondToReschedule */
export async function respondToRescheduleAsProvider(
  appointmentId: string,
  decision: 'confirmed' | 'cancelled'
): Promise<Appointment> {
  return respondToReschedule(appointmentId, decision);
}

export async function cancelAppointmentAsProvider(appointmentId: string): Promise<Appointment> {
  const { data, error } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      reschedule_starts_at: null,
      reschedule_ends_at: null,
      reschedule_requested_by: null,
    })
    .eq('id', appointmentId)
    .in('status', ['pending', 'confirmed'])
    .select(PROVIDER_APPOINTMENT_SELECT)
    .single();

  if (error) throw error;
  return normalizeAppointment(data as unknown as Appointment);
}

export function subscribeToAppointmentUpdates(participantId: string, onChange: () => void) {
  return subscribeToTableChanges(
    `appointments:participant:${participantId}`,
    'appointments',
    onChange,
    `appointments for ${participantId}`
  );
}
