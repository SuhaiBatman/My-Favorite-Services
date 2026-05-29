-- Create a table for public profiles
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  first_name text,
  last_name text,
  middle_initial text,
  email text,
  age text,
  gender text,
  phone text,
  role text check (role in ('user', 'employee', 'business')),
  roles text[],

  -- Employee fields
  job_title text,
  bio text,
  services text,
  is_self_employed boolean default false,

  -- Business fields (used by business role AND self-employed employees)
  business_name text,
  industry text,
  business_description text,
  website text,
  location text,

  -- Schedule (employee)
  timings text,
  work_days text,

  -- User preferences
  interests text,

  constraint first_name_length check (char_length(first_name) >= 1)
);

-- Set up Row Level Security (RLS)
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone." on public.profiles
  for select using (true);

create policy "Users can insert their own profile." on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on public.profiles
  for update using (auth.uid() = id);

-- This trigger automatically creates a profile entry when a new user signs up via Supabase Auth.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name', new.raw_user_meta_data->>'role');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Favorites (users saving provider profiles)
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  provider_id uuid references public.profiles on delete cascade not null,
  created_at timestamp with time zone default timezone('utc', now()) not null,
  unique (user_id, provider_id)
);

alter table public.favorites enable row level security;

create policy "Users can view their own favorites" on public.favorites
  for select using (auth.uid() = user_id);

create policy "Users can add favorites" on public.favorites
  for insert with check (auth.uid() = user_id);

create policy "Users can remove their favorites" on public.favorites
  for delete using (auth.uid() = user_id);

-- Structured employee data (performance-friendly querying)
create table public.employee_services (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.profiles on delete cascade not null,
  name text not null,
  name_normalized text not null,
  created_at timestamp with time zone default timezone('utc', now()) not null,
  unique (employee_id, name_normalized)
);

create table public.employee_availability (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.profiles on delete cascade not null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_minutes smallint not null check (start_minutes between 0 and 1439),
  end_minutes smallint not null check (end_minutes between 1 and 1440),
  created_at timestamp with time zone default timezone('utc', now()) not null,
  check (end_minutes > start_minutes),
  unique (employee_id, day_of_week)
);

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
  website text,
  role text,
  roles text[],
  services text[],
  availability jsonb,
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

-- Migration from existing schema (run if upgrading):
-- ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'employee', 'business'));
-- UPDATE public.profiles SET role = 'employee' WHERE role = 'provider';
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS services text;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_self_employed boolean DEFAULT false;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS industry text;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_description text;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website text;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS interests text;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location text;
