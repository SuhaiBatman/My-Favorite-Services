-- Popular / matching job titles from all user profiles.
create or replace function public.search_job_title_suggestions(
  search_query text default '',
  result_limit int default 10
)
returns table (title text, usage_count bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := lower(trim(coalesce(search_query, '')));
  lim int := greatest(1, least(coalesce(result_limit, 10), 25));
begin
  return query
  with aggregated as (
    select trim(p.job_title) as title, count(*)::bigint as usage_count
    from public.profiles p
    where trim(coalesce(p.job_title, '')) <> ''
    group by lower(trim(p.job_title)), trim(p.job_title)
  )
  select a.title, a.usage_count
  from aggregated a
  where q = '' or lower(a.title) like '%' || q || '%'
  order by a.usage_count desc, lower(a.title) asc
  limit lim;
end;
$$;

grant execute on function public.search_job_title_suggestions(text, int) to anon, authenticated;
