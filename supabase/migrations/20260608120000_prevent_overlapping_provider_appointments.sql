create extension if not exists btree_gist with schema extensions;

alter table public.appointments
  drop constraint if exists appointments_provider_no_overlap;

alter table public.appointments
  add constraint appointments_provider_no_overlap
  exclude using gist (
    provider_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status <> 'cancelled');
