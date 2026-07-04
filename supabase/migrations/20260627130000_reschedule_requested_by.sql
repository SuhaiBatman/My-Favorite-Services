-- Track who initiated a reschedule so the other party accepts/declines
alter table public.appointments
  add column if not exists reschedule_requested_by uuid references public.profiles (id) on delete set null;

-- Notify client when provider requests a reschedule
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
      elsif new.status = 'cancelled' and old.status = 'confirmed' then
        insert into public.notifications (user_id, type, title, body, data)
        values (
          v_client_id,
          'appointment_declined',
          'Appointment cancelled',
          v_provider_name || ' cancelled your ' || new.service_name || ' appointment.',
          jsonb_build_object('appointment_id', v_appt_id, 'provider_id', v_provider_id)
        );
      end if;
    end if;

    if old.reschedule_starts_at is null and new.reschedule_starts_at is not null then
      if new.reschedule_requested_by = v_provider_id then
        insert into public.notifications (user_id, type, title, body, data)
        values (
          v_client_id,
          'reschedule_requested',
          'Reschedule requested',
          v_provider_name || ' requested to reschedule ' || new.service_name || '.',
          jsonb_build_object('appointment_id', v_appt_id, 'provider_id', v_provider_id)
        );
      else
        insert into public.notifications (user_id, type, title, body, data)
        values (
          v_provider_id,
          'reschedule_requested',
          'Reschedule requested',
          v_client_name || ' requested to reschedule ' || new.service_name || '.',
          jsonb_build_object('appointment_id', v_appt_id, 'client_id', v_client_id)
        );
      end if;
    end if;

    if old.reschedule_starts_at is not null and new.reschedule_starts_at is null then
      if old.starts_at is distinct from new.starts_at then
        if old.reschedule_requested_by = v_client_id then
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
            'reschedule_accepted',
            'Reschedule accepted',
            v_provider_name || ' updated your ' || new.service_name || ' appointment time.',
            jsonb_build_object('appointment_id', v_appt_id, 'provider_id', v_provider_id)
          );
        end if;
      else
        if old.reschedule_requested_by = v_client_id then
          insert into public.notifications (user_id, type, title, body, data)
          values (
            v_client_id,
            'reschedule_declined',
            'Reschedule declined',
            v_provider_name || ' declined your reschedule request for ' || new.service_name || '.',
            jsonb_build_object('appointment_id', v_appt_id, 'provider_id', v_provider_id)
          );
        else
          insert into public.notifications (user_id, type, title, body, data)
          values (
            v_client_id,
            'reschedule_declined',
            'Reschedule declined',
            'Your reschedule request for ' || new.service_name || ' was declined.',
            jsonb_build_object('appointment_id', v_appt_id, 'provider_id', v_provider_id)
          );
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;
