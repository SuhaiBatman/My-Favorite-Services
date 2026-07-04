-- Reschedule proposal fields (client requests new time; provider accepts/declines)
alter table public.appointments
  add column if not exists reschedule_starts_at timestamp with time zone,
  add column if not exists reschedule_ends_at timestamp with time zone;

alter table public.appointments
  drop constraint if exists appointments_reschedule_range_check;

alter table public.appointments
  add constraint appointments_reschedule_range_check
  check (
    (reschedule_starts_at is null and reschedule_ends_at is null)
    or (
      reschedule_starts_at is not null
      and reschedule_ends_at is not null
      and reschedule_ends_at > reschedule_starts_at
    )
  );

-- In-app notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade not null,
  type text not null check (
    type in (
      'new_appointment',
      'appointment_confirmed',
      'appointment_declined',
      'appointment_rescheduled',
      'reschedule_requested',
      'reschedule_accepted',
      'reschedule_declined',
      'new_client'
    )
  ),
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc', now()) not null
);

create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_id_unread_idx
  on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

grant select, update on public.notifications to authenticated;

-- Realtime for live appointment updates
alter publication supabase_realtime add table public.appointments;
alter publication supabase_realtime add table public.notifications;

create or replace function public.notify_appointment_participants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_name text;
  v_provider_name text;
  v_client_id uuid;
  v_provider_id uuid;
  v_appt_id uuid;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  v_client_id := new.user_id;
  v_provider_id := new.provider_id;
  v_appt_id := new.id;

  select trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
  into v_client_name
  from public.profiles where id = v_client_id;

  select trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
  into v_provider_name
  from public.profiles where id = v_provider_id;

  if v_client_name = '' then v_client_name := 'A client'; end if;
  if v_provider_name = '' then v_provider_name := 'Your provider'; end if;

  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      v_provider_id,
      'new_appointment',
      'New appointment request',
      v_client_name || ' requested ' || new.service_name || '.',
      jsonb_build_object('appointment_id', v_appt_id, 'client_id', v_client_id)
    );

    if not exists (
      select 1 from public.appointments a
      where a.provider_id = v_provider_id
        and a.user_id = v_client_id
        and a.id <> v_appt_id
    ) then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        v_provider_id,
        'new_client',
        'New client',
        v_client_name || ' booked with you for the first time.',
        jsonb_build_object('appointment_id', v_appt_id, 'client_id', v_client_id)
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status is distinct from new.status then
      if new.status = 'confirmed' and old.status = 'pending' then
        insert into public.notifications (user_id, type, title, body, data)
        values (
          v_client_id,
          'appointment_confirmed',
          'Appointment confirmed',
          v_provider_name || ' confirmed your ' || new.service_name || ' appointment.',
          jsonb_build_object('appointment_id', v_appt_id, 'provider_id', v_provider_id)
        );
      elsif new.status = 'cancelled' and old.status = 'pending' then
        insert into public.notifications (user_id, type, title, body, data)
        values (
          v_client_id,
          'appointment_declined',
          'Appointment declined',
          v_provider_name || ' declined your ' || new.service_name || ' request.',
          jsonb_build_object('appointment_id', v_appt_id, 'provider_id', v_provider_id)
        );
      end if;
    end if;

    if old.reschedule_starts_at is null and new.reschedule_starts_at is not null then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        v_provider_id,
        'reschedule_requested',
        'Reschedule requested',
        v_client_name || ' requested to reschedule ' || new.service_name || '.',
        jsonb_build_object('appointment_id', v_appt_id, 'client_id', v_client_id)
      );
    end if;

    if old.reschedule_starts_at is not null and new.reschedule_starts_at is null then
      if old.starts_at is distinct from new.starts_at then
        insert into public.notifications (user_id, type, title, body, data)
        values (
          v_client_id,
          'reschedule_accepted',
          'Reschedule accepted',
          v_provider_name || ' accepted your new time for ' || new.service_name || '.',
          jsonb_build_object('appointment_id', v_appt_id, 'provider_id', v_provider_id)
        );
      else
        insert into public.notifications (user_id, type, title, body, data)
        values (
          v_client_id,
          'reschedule_declined',
          'Reschedule declined',
          v_provider_name || ' declined your reschedule request for ' || new.service_name || '.',
          jsonb_build_object('appointment_id', v_appt_id, 'provider_id', v_provider_id)
        );
      end if;
    end if;

    if old.starts_at is distinct from new.starts_at
       and old.reschedule_starts_at is null
       and new.reschedule_starts_at is null
       and old.status = 'confirmed'
       and new.status = 'confirmed' then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        v_provider_id,
        'appointment_rescheduled',
        'Appointment updated',
        v_client_name || ' updated their ' || new.service_name || ' appointment time.',
        jsonb_build_object('appointment_id', v_appt_id, 'client_id', v_client_id)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_appointment_notify on public.appointments;
create trigger on_appointment_notify
  after insert or update on public.appointments
  for each row execute function public.notify_appointment_participants();
