-- Migration for existing databases that had the old 'provider'/'user' role schema.
-- Skip this if starting fresh (20260527000000 already has the correct schema).

-- Add new columns if they don't exist
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists services text;
alter table public.profiles add column if not exists is_self_employed boolean default false;
alter table public.profiles add column if not exists industry text;
alter table public.profiles add column if not exists business_description text;
alter table public.profiles add column if not exists website text;
alter table public.profiles add column if not exists interests text;
alter table public.profiles add column if not exists location text;

-- Rename 'provider' role to 'employee'
update public.profiles set role = 'employee' where role = 'provider';

-- Update role constraint to reflect new user types
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('user', 'employee', 'business'));
