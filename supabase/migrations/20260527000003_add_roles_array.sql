-- Support multiple roles per profile (e.g. employee + user)
alter table public.profiles add column if not exists roles text[];

-- Backfill from legacy single role column
update public.profiles
set roles = case
  when role = 'employee' then array['employee', 'user']::text[]
  when role = 'business' then array['business']::text[]
  when role = 'user' then array['user']::text[]
  else roles
end
where roles is null and role is not null;

alter table public.profiles drop constraint if exists profiles_roles_check;
alter table public.profiles add constraint profiles_roles_check
  check (
    roles is null
    or roles <@ array['user', 'employee', 'business']::text[]
  );
