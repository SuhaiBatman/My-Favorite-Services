import { supabase } from './supabase';

export async function isFavorite(providerId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('provider_id', providerId)
    .maybeSingle();

  if (error) {
    console.error('isFavorite:', error);
    return false;
  }
  return !!data;
}

export async function addFavorite(providerId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('favorites').insert({
    user_id: userId,
    provider_id: providerId,
  });

  if (error && error.code !== '23505') {
    throw error;
  }
}

export async function removeFavorite(providerId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('provider_id', providerId);

  if (error) throw error;
}

export type FavoriteProvider = {
  id: string;
  provider_id: string;
  created_at: string;
  profiles: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    job_title: string | null;
    business_name: string | null;
    bio: string | null;
    services: string | null;
    location: string | null;
  } | null;
};

export async function listFavorites(userId: string): Promise<FavoriteProvider[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select(
      `
      id,
      provider_id,
      created_at,
      profiles:provider_id (
        id,
        first_name,
        last_name,
        job_title,
        business_name,
        bio,
        services,
        location
      )
    `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    provider_id: row.provider_id,
    created_at: row.created_at,
    profiles: Array.isArray(row.profiles) ? (row.profiles[0] ?? null) : row.profiles ?? null,
  }));
}
