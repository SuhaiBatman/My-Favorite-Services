alter table public.employee_services
  add column if not exists duration_minutes integer,
  add column if not exists price_cents integer;

alter table public.employee_services
  drop constraint if exists employee_services_duration_minutes_check;

alter table public.employee_services
  add constraint employee_services_duration_minutes_check
  check (duration_minutes is null or duration_minutes > 0);

alter table public.employee_services
  drop constraint if exists employee_services_price_cents_check;

alter table public.employee_services
  add constraint employee_services_price_cents_check
  check (price_cents is null or price_cents >= 0);
