create table if not exists public.employee_services (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.profiles on delete cascade not null,
  name text not null,
  name_normalized text not null,
  created_at timestamp with time zone default timezone('utc', now()) not null,
  unique (employee_id, name_normalized)
);

create index if not exists employee_services_employee_id_idx
  on public.employee_services (employee_id);

create index if not exists employee_services_name_normalized_idx
  on public.employee_services (name_normalized);

alter table public.employee_services enable row level security;

create policy "Public can view employee services"
  on public.employee_services for select
  using (true);

create policy "Employees can manage own services"
  on public.employee_services for all
  using (auth.uid() = employee_id)
  with check (auth.uid() = employee_id);

create table if not exists public.employee_availability (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.profiles on delete cascade not null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_minutes smallint not null check (start_minutes between 0 and 1439),
  end_minutes smallint not null check (end_minutes between 1 and 1440),
  created_at timestamp with time zone default timezone('utc', now()) not null,
  check (end_minutes > start_minutes),
  unique (employee_id, day_of_week)
);

create index if not exists employee_availability_employee_id_idx
  on public.employee_availability (employee_id);

create index if not exists employee_availability_day_of_week_idx
  on public.employee_availability (day_of_week);

alter table public.employee_availability enable row level security;

create policy "Public can view employee availability"
  on public.employee_availability for select
  using (true);

create policy "Employees can manage own availability"
  on public.employee_availability for all
  using (auth.uid() = employee_id)
  with check (auth.uid() = employee_id);

grant select, insert, update, delete on public.employee_services to authenticated;
grant select, insert, update, delete on public.employee_availability to authenticated;
