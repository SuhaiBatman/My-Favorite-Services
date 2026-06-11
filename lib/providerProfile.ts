import {
  profileFieldsToSlots,
  type ProviderAvailabilitySlot,
} from './profileSchedule';
import { supabase } from './supabase';

export type { ProviderAvailabilitySlot };

export type ProviderProfilePayload = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  business_name: string | null;
  bio: string | null;
  industry: string | null;
  business_description: string | null;
  is_self_employed: boolean;
  location: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  role: string | null;
  roles: string[] | null;
  services: string[] | null;
  availability: ProviderAvailabilitySlot[];
  flexible_hours: boolean;
  is_favorite: boolean;
};

type ProviderProfileRow = {
  timings: string | null;
  work_days: string | null;
  industry: string | null;
  business_description: string | null;
  is_self_employed: boolean | null;
  services: string | null;
};

function normalizeAvailability(value: unknown): ProviderAvailabilitySlot[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (slot): slot is ProviderAvailabilitySlot =>
      slot != null &&
      typeof slot === 'object' &&
      typeof (slot as ProviderAvailabilitySlot).day_of_week === 'number' &&
      typeof (slot as ProviderAvailabilitySlot).start_minutes === 'number' &&
      typeof (slot as ProviderAvailabilitySlot).end_minutes === 'number'
  );
}

function mergeProviderProfile(
  rpcProfile: Record<string, unknown>,
  profileRow: ProviderProfileRow | null
): ProviderProfilePayload {
  let availability = normalizeAvailability(rpcProfile.availability);

  if (availability.length === 0 && profileRow) {
    availability = profileFieldsToSlots(profileRow.work_days, profileRow.timings);
  }

  const rpcServices = rpcProfile.services;
  const services =
    Array.isArray(rpcServices) && rpcServices.length > 0
      ? rpcServices.filter((service): service is string => typeof service === 'string')
      : profileRow?.services
        ? profileRow.services.split(', ').filter(Boolean)
        : null;

  return {
    id: String(rpcProfile.id),
    first_name: (rpcProfile.first_name as string | null) ?? null,
    last_name: (rpcProfile.last_name as string | null) ?? null,
    job_title: (rpcProfile.job_title as string | null) ?? null,
    business_name: (rpcProfile.business_name as string | null) ?? null,
    bio: (rpcProfile.bio as string | null) ?? null,
    industry: (rpcProfile.industry as string | null) ?? profileRow?.industry ?? null,
    business_description:
      (rpcProfile.business_description as string | null) ??
      profileRow?.business_description ??
      null,
    is_self_employed: Boolean(
      rpcProfile.is_self_employed ?? profileRow?.is_self_employed ?? false
    ),
    location: (rpcProfile.location as string | null) ?? null,
    phone: (rpcProfile.phone as string | null) ?? null,
    email: (rpcProfile.email as string | null) ?? null,
    website: (rpcProfile.website as string | null) ?? null,
    role: (rpcProfile.role as string | null) ?? null,
    roles: (rpcProfile.roles as string[] | null) ?? null,
    services,
    availability,
    flexible_hours: Boolean(rpcProfile.flexible_hours),
    is_favorite: Boolean(rpcProfile.is_favorite),
  };
}

export async function fetchProviderProfile(
  providerId: string
): Promise<ProviderProfilePayload | null> {
  const [rpcResult, profileResult] = await Promise.all([
    supabase.rpc('get_provider_profile', { p_provider_id: providerId }),
    supabase
      .from('profiles')
      .select('timings, work_days, industry, business_description, is_self_employed, services')
      .eq('id', providerId)
      .maybeSingle(),
  ]);

  if (rpcResult.error) throw rpcResult.error;
  if (!rpcResult.data || !Array.isArray(rpcResult.data) || rpcResult.data.length === 0) {
    return null;
  }

  return mergeProviderProfile(
    rpcResult.data[0] as Record<string, unknown>,
    profileResult.data as ProviderProfileRow | null
  );
}
