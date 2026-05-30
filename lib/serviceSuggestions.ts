import { supabase } from './supabase';

export type ServiceSuggestion = {
  name: string;
  usageCount: number;
};

export async function searchServiceSuggestions(
  query: string,
  limit = 8
): Promise<ServiceSuggestion[]> {
  try {
    const { data, error } = await supabase.rpc('search_service_suggestions', {
      search_query: query.trim(),
      result_limit: limit,
    });

    if (error) {
      if (__DEV__) {
        const hint =
          error.message === 'Invalid API key'
            ? ' — check Metro log for [supabase] hosted/local URL and key type, then restart with `npx expo start -c`'
            : '';
        console.warn('[serviceSuggestions] rpc failed', error.message + hint);
      }
      return [];
    }

    return (data ?? []).map((row: { name: string; usage_count: number }) => ({
      name: row.name,
      usageCount: Number(row.usage_count) || 0,
    }));
  } catch (err) {
    if (__DEV__) console.warn('[serviceSuggestions] search failed', err);
    return [];
  }
}
