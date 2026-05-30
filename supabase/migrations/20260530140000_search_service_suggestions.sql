-- Popular / matching service names from all users (structured + legacy profile text).
create or replace function public.search_service_suggestions(
  search_query text default '',
  result_limit int default 10
)
returns table (name text, usage_count bigint)
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
  with all_services as (
    select trim(es.name) as svc_name
    from public.employee_services es
    where trim(es.name) <> ''
    union all
    select trim(x) as svc_name
    from public.profiles p,
    lateral unnest(string_to_array(nullif(trim(p.services), ''), ',')) as x
    where trim(x) <> ''
  ),
  aggregated as (
    select svc_name as name, count(*)::bigint as usage_count
    from all_services
    group by lower(svc_name), svc_name
  )
  select a.name, a.usage_count
  from aggregated a
  where q = '' or lower(a.name) like '%' || q || '%'
  order by a.usage_count desc, lower(a.name) asc
  limit lim;
end;
$$;

grant execute on function public.search_service_suggestions(text, int) to anon, authenticated;
