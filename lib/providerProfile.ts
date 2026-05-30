import { supabase } from './supabase';

export type ProviderAvailabilitySlot = {
  day_of_week: number;
  start_minutes: number;
  end_minutes: number;
};

export type ProviderProfilePayload = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  business_name: string | null;
  bio: string | null;
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

export async function fetchProviderProfile(providerId: string): Promise<ProviderProfilePayload | null> {
  const { data, error } = await supabase.rpc('get_provider_profile', {
    p_provider_id: providerId,
  });

  if (error) throw error;
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  return data[0] as ProviderProfilePayload;
}
