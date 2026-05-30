alter table public.profiles
  add column if not exists flexible_hours boolean not null default false;

drop function if exists public.get_provider_profile(uuid);

create or replace function public.get_provider_profile(p_provider_id uuid)
returns table (
  id uuid,
  first_name text,
  last_name text,
  job_title text,
  business_name text,
  bio text,
  location text,
  phone text,
  email text,
  website text,
  role text,
  roles text[],
  services text[],
  availability jsonb,
  flexible_hours boolean,
  is_favorite boolean
)
language sql
stable
security invoker
as $$
  select
    p.id,
    p.first_name,
    p.last_name,
    p.job_title,
    p.business_name,
    p.bio,
    p.location,
    p.phone,
    p.email,
    p.website,
    p.role,
    p.roles,
    coalesce(
      (
        select array_agg(es.name order by es.name)
        from public.employee_services es
        where es.employee_id = p.id
      ),
      string_to_array(nullif(p.services, ''), ', ')
    ) as services,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'day_of_week', ea.day_of_week,
            'start_minutes', ea.start_minutes,
            'end_minutes', ea.end_minutes
          )
          order by ea.day_of_week
        )
        from public.employee_availability ea
        where ea.employee_id = p.id
      ),
      '[]'::jsonb
    ) as availability,
    coalesce(p.flexible_hours, false) as flexible_hours,
    exists(
      select 1
      from public.favorites f
      where f.user_id = auth.uid()
        and f.provider_id = p.id
    ) as is_favorite
  from public.profiles p
  where p.id = p_provider_id
  limit 1;
$$;

grant execute on function public.get_provider_profile(uuid) to authenticated, anon;
