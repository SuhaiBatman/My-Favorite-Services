-- Create profiles table for all user types
create table if not exists public.profiles (
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

-- Row Level Security
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on public.profiles for select using (true);

create policy "Users can insert their own profile."
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile."
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'role'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
