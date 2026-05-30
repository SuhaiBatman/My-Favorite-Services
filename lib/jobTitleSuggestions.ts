import { supabase } from './supabase';

export type JobTitleSuggestion = {
  title: string;
  usageCount: number;
};

export async function searchJobTitleSuggestions(
  query: string,
  limit = 8
): Promise<JobTitleSuggestion[]> {
  try {
    const { data, error } = await supabase.rpc('search_job_title_suggestions', {
      search_query: query.trim(),
      result_limit: limit,
    });

    if (error) {
      if (__DEV__) {
        const hint =
          error.message === 'Invalid API key'
            ? ' — check Metro log for [supabase] hosted/local URL and key type, then restart with `npx expo start -c`'
            : '';
        console.warn('[jobTitleSuggestions] rpc failed', error.message + hint);
      }
      return [];
    }

    return (data ?? []).map((row: { title: string; usage_count: number }) => ({
      title: row.title,
      usageCount: Number(row.usage_count) || 0,
    }));
  } catch (err) {
    if (__DEV__) console.warn('[jobTitleSuggestions] search failed', err);
    return [];
  }
}
