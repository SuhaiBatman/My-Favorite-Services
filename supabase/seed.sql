-- =============================================================================
-- Local dev seed — runs on `supabase db reset`
--
-- Demo login (password for all accounts): password123
--   Consumer:  alex@demo.local     (favorites, appointments, messages)
--
-- Providers (employees) use *@provider.demo.local — browse/message/book any of them.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Auth users + identities
-- -----------------------------------------------------------------------------

do $$
declare
  v_pw text := crypt('password123', gen_salt('bf'));
  v_instance uuid := '00000000-0000-0000-0000-000000000000';
begin
  -- Consumer
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, recovery_sent_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    v_instance,
    'a0000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    'alex@demo.local', v_pw,
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Alex","last_name":"Rivera","role":"user","roles":["user"]}',
    now(), now(),
    '', '', '', ''
  ) on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values (
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    '{"sub":"a0000000-0000-4000-8000-000000000001","email":"alex@demo.local"}'::jsonb,
    'email',
    'a0000000-0000-4000-8000-000000000001',
    now(), now(), now()
  ) on conflict (id) do nothing;

  -- Providers (employees)
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, recovery_sent_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  select
    v_instance,
    p.id,
    'authenticated', 'authenticated',
    p.email, v_pw,
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'first_name', p.first_name,
      'last_name', p.last_name,
      'role', 'employee',
      'roles', array['employee', 'user']
    ),
    now(), now(),
    '', '', '', ''
  from (values
    ('b0000000-0000-4000-8000-000000000001'::uuid, 'elena@provider.demo.local', 'Elena', 'Sterling'),
    ('b0000000-0000-4000-8000-000000000002'::uuid, 'julian@provider.demo.local', 'Julian', 'Vance'),
    ('b0000000-0000-4000-8000-000000000003'::uuid, 'sophia@provider.demo.local', 'Sophia', 'Lane'),
    ('b0000000-0000-4000-8000-000000000004'::uuid, 'marcus@provider.demo.local', 'Marcus', 'Reid'),
    ('b0000000-0000-4000-8000-000000000005'::uuid, 'priya@provider.demo.local', 'Priya', 'Nair'),
    ('b0000000-0000-4000-8000-000000000006'::uuid, 'alex.c@provider.demo.local', 'Alex', 'Carter'),
    ('b0000000-0000-4000-8000-000000000007'::uuid, 'james@provider.demo.local', 'James', 'Wu'),
    ('b0000000-0000-4000-8000-000000000008'::uuid, 'nina@provider.demo.local', 'Nina', 'Torres'),
    ('b0000000-0000-4000-8000-000000000009'::uuid, 'metro@provider.demo.local', 'Metro', 'Ride Co'),
    ('b0000000-0000-4000-8000-00000000000a'::uuid, 'green@provider.demo.local', 'GreenNest', 'Cleaning')
  ) as p(id, email, first_name, last_name)
  on conflict (id) do nothing;

  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  select
    p.id, p.id,
    jsonb_build_object('sub', p.id::text, 'email', p.email),
    'email', p.id::text,
    now(), now(), now()
  from (values
    ('b0000000-0000-4000-8000-000000000001'::uuid, 'elena@provider.demo.local'),
    ('b0000000-0000-4000-8000-000000000002'::uuid, 'julian@provider.demo.local'),
    ('b0000000-0000-4000-8000-000000000003'::uuid, 'sophia@provider.demo.local'),
    ('b0000000-0000-4000-8000-000000000004'::uuid, 'marcus@provider.demo.local'),
    ('b0000000-0000-4000-8000-000000000005'::uuid, 'priya@provider.demo.local'),
    ('b0000000-0000-4000-8000-000000000006'::uuid, 'alex.c@provider.demo.local'),
    ('b0000000-0000-4000-8000-000000000007'::uuid, 'james@provider.demo.local'),
    ('b0000000-0000-4000-8000-000000000008'::uuid, 'nina@provider.demo.local'),
    ('b0000000-0000-4000-8000-000000000009'::uuid, 'metro@provider.demo.local'),
    ('b0000000-0000-4000-8000-00000000000a'::uuid, 'green@provider.demo.local')
  ) as p(id, email)
  on conflict (id) do nothing;
end $$;

-- -----------------------------------------------------------------------------
-- Profiles (trigger may have created minimal rows — enrich them)
-- -----------------------------------------------------------------------------

update public.profiles set
  first_name = 'Alex', last_name = 'Rivera', email = 'alex@demo.local',
  role = 'user', roles = array['user']::text[],
  interests = 'beauty,fitness,wellness',
  updated_at = now()
where id = 'a0000000-0000-4000-8000-000000000001';

update public.profiles set
  first_name = 'Elena', last_name = 'Sterling', email = 'elena@provider.demo.local',
  role = 'employee', roles = array['employee', 'user']::text[],
  job_title = 'Senior Dermatologist', business_name = 'Harvey Health Clinic',
  bio = 'Board-certified dermatologist specializing in medical and cosmetic skin care.',
  phone = '+1 (555) 201-1001', website = 'harveyhealth.demo',
  location = '1200 Market St, Suite 400, San Francisco, CA',
  services = 'Initial Consultation, Follow-up Visit, Acne Treatment',
  work_days = 'Mon, Tue, Wed, Thu, Fri', timings = 'Mon: 09:00 AM - 05:00 PM',
  updated_at = now()
where id = 'b0000000-0000-4000-8000-000000000001';

update public.profiles set
  first_name = 'Julian', last_name = 'Vance', email = 'julian@provider.demo.local',
  role = 'employee', roles = array['employee', 'user']::text[],
  job_title = 'Master Barber & Grooming Specialist', business_name = 'The Gentlemen''s Chair',
  bio = 'Precision cuts, hot towel shaves, and beard sculpting for over 12 years.',
  phone = '+1 (555) 201-1002', website = 'gentlemenschair.demo',
  location = '88 Valencia St, San Francisco, CA',
  services = 'The Signature Cut, Beard Trim, Hot Towel Shave',
  work_days = 'Tue, Wed, Thu, Fri, Sat', timings = 'Tue: 10:00 AM - 07:00 PM',
  updated_at = now()
where id = 'b0000000-0000-4000-8000-000000000002';

update public.profiles set
  first_name = 'Sophia', last_name = 'Lane', email = 'sophia@provider.demo.local',
  role = 'employee', roles = array['employee', 'user']::text[],
  job_title = 'Licensed Massage Therapist', business_name = 'Restore Wellness',
  bio = 'Deep tissue, sports recovery, and relaxation massage tailored to you.',
  phone = '+1 (555) 201-1003', website = 'restorewellness.demo',
  location = '450 Hayes St, San Francisco, CA',
  services = 'Deep Tissue Massage, Relaxation Massage, Sports Recovery',
  work_days = 'Mon, Wed, Fri, Sat', timings = 'Wed: 09:00 AM - 06:00 PM',
  updated_at = now()
where id = 'b0000000-0000-4000-8000-000000000003';

update public.profiles set
  first_name = 'Marcus', last_name = 'Reid', email = 'marcus@provider.demo.local',
  role = 'employee', roles = array['employee', 'user']::text[],
  job_title = 'Personal Trainer', business_name = 'Peak Performance SF',
  bio = 'Strength, conditioning, and mobility coaching for all fitness levels.',
  phone = '+1 (555) 201-1004', website = 'peakperformance.demo',
  location = 'Ocean Beach Gym, San Francisco, CA',
  services = 'Strength & Conditioning, HIIT Session, Mobility Assessment',
  work_days = 'Mon, Tue, Thu, Fri, Sat', timings = 'Mon: 06:00 AM - 02:00 PM',
  updated_at = now()
where id = 'b0000000-0000-4000-8000-000000000004';

update public.profiles set
  first_name = 'Priya', last_name = 'Nair', email = 'priya@provider.demo.local',
  role = 'employee', roles = array['employee', 'user']::text[],
  job_title = 'Nutritionist & Diet Coach', business_name = 'Nourish Lab',
  bio = 'Evidence-based nutrition plans and habit coaching for lasting results.',
  phone = '+1 (555) 201-1005', website = 'nourishlab.demo',
  location = 'Virtual / 200 Pine St, San Francisco, CA',
  services = 'Meal Plan Review, Initial Nutrition Consult, Follow-up Check-in',
  work_days = 'Tue, Wed, Thu', timings = 'Tue: 11:00 AM - 07:00 PM',
  updated_at = now()
where id = 'b0000000-0000-4000-8000-000000000005';

update public.profiles set
  first_name = 'Alex', last_name = 'Carter', email = 'alex.c@provider.demo.local',
  role = 'employee', roles = array['employee', 'user']::text[],
  job_title = 'Hair Colorist & Stylist', business_name = 'Chroma Salon',
  bio = 'Balayage, vivid color, and precision styling for every hair type.',
  phone = '+1 (555) 201-1006', website = 'chromasalon.demo',
  location = '1024 Divisadero St, San Francisco, CA',
  services = 'Full Color & Toner, Cut & Style, Root Touch-up',
  work_days = 'Wed, Thu, Fri, Sat', timings = 'Thu: 10:00 AM - 08:00 PM',
  updated_at = now()
where id = 'b0000000-0000-4000-8000-000000000006';

update public.profiles set
  first_name = 'James', last_name = 'Wu', email = 'james@provider.demo.local',
  role = 'employee', roles = array['employee', 'user']::text[],
  job_title = 'Sports Medicine Physician', business_name = 'Bay Area Sports Med',
  bio = 'Injury assessment, recovery plans, and return-to-play guidance.',
  phone = '+1 (555) 201-1007', website = 'basportsmed.demo',
  location = '1 Warriors Way, Suite 210, San Francisco, CA',
  services = 'Injury Assessment, Follow-up Visit, Performance Screening',
  work_days = 'Mon, Tue, Wed, Thu', timings = 'Mon: 08:00 AM - 04:00 PM',
  updated_at = now()
where id = 'b0000000-0000-4000-8000-000000000007';

update public.profiles set
  first_name = 'Nina', last_name = 'Torres', email = 'nina@provider.demo.local',
  role = 'employee', roles = array['employee', 'user']::text[],
  job_title = 'Esthetician & Skin Specialist', business_name = 'Glow Studio',
  bio = 'HydraFacial, chemical peels, and customized facial treatments.',
  phone = '+1 (555) 201-1008', website = 'glowstudio.demo',
  location = '580 Castro St, San Francisco, CA',
  services = 'HydraFacial Treatment, Chemical Peel, Custom Facial',
  work_days = 'Tue, Wed, Fri, Sat', timings = 'Fri: 09:00 AM - 05:00 PM',
  updated_at = now()
where id = 'b0000000-0000-4000-8000-000000000008';

update public.profiles set
  first_name = 'Metro', last_name = 'Ride Co', email = 'metro@provider.demo.local',
  role = 'employee', roles = array['employee', 'user']::text[],
  job_title = 'Private Driver', business_name = 'Metro Ride Co.',
  bio = 'On-demand rides and airport transfers across the Bay Area.',
  phone = '+1 (555) 201-1009', website = 'metroride.demo',
  location = 'Pickup anywhere in SF / Bay Area',
  services = 'Standard Ride, Airport Transfer, Hourly Charter',
  work_days = 'Mon, Tue, Wed, Thu, Fri, Sat, Sun', timings = 'Daily: 06:00 AM - 11:00 PM',
  is_self_employed = true, updated_at = now()
where id = 'b0000000-0000-4000-8000-000000000009';

update public.profiles set
  first_name = 'GreenNest', last_name = 'Cleaning', email = 'green@provider.demo.local',
  role = 'employee', roles = array['employee', 'user']::text[],
  job_title = 'Home Cleaning', business_name = 'GreenNest Cleaning',
  bio = 'Eco-friendly home cleaning — standard, deep clean, and move-out packages.',
  phone = '+1 (555) 201-1010', website = 'greennest.demo',
  location = 'Service at your address (SF & Peninsula)',
  services = 'Standard Home Clean, Deep Clean, Move-out Clean',
  work_days = 'Mon, Tue, Wed, Thu, Fri', timings = 'Mon: 08:00 AM - 06:00 PM',
  is_self_employed = true, updated_at = now()
where id = 'b0000000-0000-4000-8000-00000000000a';

-- -----------------------------------------------------------------------------
-- Structured services
-- -----------------------------------------------------------------------------

insert into public.employee_services (employee_id, name, name_normalized) values
  ('b0000000-0000-4000-8000-000000000001', 'Initial Consultation', 'initial consultation'),
  ('b0000000-0000-4000-8000-000000000001', 'Follow-up Visit', 'follow-up visit'),
  ('b0000000-0000-4000-8000-000000000001', 'Acne Treatment', 'acne treatment'),
  ('b0000000-0000-4000-8000-000000000002', 'The Signature Cut', 'the signature cut'),
  ('b0000000-0000-4000-8000-000000000002', 'Beard Trim', 'beard trim'),
  ('b0000000-0000-4000-8000-000000000002', 'Hot Towel Shave', 'hot towel shave'),
  ('b0000000-0000-4000-8000-000000000003', 'Deep Tissue Massage', 'deep tissue massage'),
  ('b0000000-0000-4000-8000-000000000003', 'Relaxation Massage', 'relaxation massage'),
  ('b0000000-0000-4000-8000-000000000003', 'Sports Recovery', 'sports recovery'),
  ('b0000000-0000-4000-8000-000000000004', 'Strength & Conditioning', 'strength & conditioning'),
  ('b0000000-0000-4000-8000-000000000004', 'HIIT Session', 'hiit session'),
  ('b0000000-0000-4000-8000-000000000004', 'Mobility Assessment', 'mobility assessment'),
  ('b0000000-0000-4000-8000-000000000005', 'Meal Plan Review', 'meal plan review'),
  ('b0000000-0000-4000-8000-000000000005', 'Initial Nutrition Consult', 'initial nutrition consult'),
  ('b0000000-0000-4000-8000-000000000005', 'Follow-up Check-in', 'follow-up check-in'),
  ('b0000000-0000-4000-8000-000000000006', 'Full Color & Toner', 'full color & toner'),
  ('b0000000-0000-4000-8000-000000000006', 'Cut & Style', 'cut & style'),
  ('b0000000-0000-4000-8000-000000000006', 'Root Touch-up', 'root touch-up'),
  ('b0000000-0000-4000-8000-000000000007', 'Injury Assessment', 'injury assessment'),
  ('b0000000-0000-4000-8000-000000000007', 'Follow-up Visit', 'follow-up visit'),
  ('b0000000-0000-4000-8000-000000000007', 'Performance Screening', 'performance screening'),
  ('b0000000-0000-4000-8000-000000000008', 'HydraFacial Treatment', 'hydrafacial treatment'),
  ('b0000000-0000-4000-8000-000000000008', 'Chemical Peel', 'chemical peel'),
  ('b0000000-0000-4000-8000-000000000008', 'Custom Facial', 'custom facial'),
  ('b0000000-0000-4000-8000-000000000009', 'Standard Ride', 'standard ride'),
  ('b0000000-0000-4000-8000-000000000009', 'Airport Transfer', 'airport transfer'),
  ('b0000000-0000-4000-8000-000000000009', 'Hourly Charter', 'hourly charter'),
  ('b0000000-0000-4000-8000-00000000000a', 'Standard Home Clean', 'standard home clean'),
  ('b0000000-0000-4000-8000-00000000000a', 'Deep Clean', 'deep clean'),
  ('b0000000-0000-4000-8000-00000000000a', 'Move-out Clean', 'move-out clean')
on conflict (employee_id, name_normalized) do nothing;

-- -----------------------------------------------------------------------------
-- Availability (day_of_week: 0=Sun … 6=Sat; minutes from midnight)
-- -----------------------------------------------------------------------------

insert into public.employee_availability (employee_id, day_of_week, start_minutes, end_minutes) values
  ('b0000000-0000-4000-8000-000000000001', 1, 540, 1020),
  ('b0000000-0000-4000-8000-000000000001', 2, 540, 1020),
  ('b0000000-0000-4000-8000-000000000001', 3, 540, 1020),
  ('b0000000-0000-4000-8000-000000000001', 4, 540, 1020),
  ('b0000000-0000-4000-8000-000000000001', 5, 540, 1020),
  ('b0000000-0000-4000-8000-000000000002', 2, 600, 1140),
  ('b0000000-0000-4000-8000-000000000002', 3, 600, 1140),
  ('b0000000-0000-4000-8000-000000000002', 4, 600, 1140),
  ('b0000000-0000-4000-8000-000000000002', 5, 600, 1140),
  ('b0000000-0000-4000-8000-000000000002', 6, 600, 1140),
  ('b0000000-0000-4000-8000-000000000003', 1, 540, 1080),
  ('b0000000-0000-4000-8000-000000000003', 3, 540, 1080),
  ('b0000000-0000-4000-8000-000000000003', 5, 540, 1080),
  ('b0000000-0000-4000-8000-000000000003', 6, 540, 1080),
  ('b0000000-0000-4000-8000-000000000004', 1, 360, 840),
  ('b0000000-0000-4000-8000-000000000004', 2, 360, 840),
  ('b0000000-0000-4000-8000-000000000004', 4, 360, 840),
  ('b0000000-0000-4000-8000-000000000004', 5, 360, 840),
  ('b0000000-0000-4000-8000-000000000004', 6, 360, 840),
  ('b0000000-0000-4000-8000-000000000005', 2, 660, 1140),
  ('b0000000-0000-4000-8000-000000000005', 3, 660, 1140),
  ('b0000000-0000-4000-8000-000000000005', 4, 660, 1140),
  ('b0000000-0000-4000-8000-000000000006', 3, 600, 1200),
  ('b0000000-0000-4000-8000-000000000006', 4, 600, 1200),
  ('b0000000-0000-4000-8000-000000000006', 5, 600, 1200),
  ('b0000000-0000-4000-8000-000000000006', 6, 600, 1200),
  ('b0000000-0000-4000-8000-000000000007', 1, 480, 960),
  ('b0000000-0000-4000-8000-000000000007', 2, 480, 960),
  ('b0000000-0000-4000-8000-000000000007', 3, 480, 960),
  ('b0000000-0000-4000-8000-000000000007', 4, 480, 960),
  ('b0000000-0000-4000-8000-000000000008', 2, 540, 1020),
  ('b0000000-0000-4000-8000-000000000008', 3, 540, 1020),
  ('b0000000-0000-4000-8000-000000000008', 5, 540, 1020),
  ('b0000000-0000-4000-8000-000000000008', 6, 540, 1020),
  ('b0000000-0000-4000-8000-000000000009', 0, 360, 1380),
  ('b0000000-0000-4000-8000-000000000009', 1, 360, 1380),
  ('b0000000-0000-4000-8000-000000000009', 2, 360, 1380),
  ('b0000000-0000-4000-8000-000000000009', 3, 360, 1380),
  ('b0000000-0000-4000-8000-000000000009', 4, 360, 1380),
  ('b0000000-0000-4000-8000-000000000009', 5, 360, 1380),
  ('b0000000-0000-4000-8000-000000000009', 6, 360, 1380),
  ('b0000000-0000-4000-8000-00000000000a', 1, 480, 1080),
  ('b0000000-0000-4000-8000-00000000000a', 2, 480, 1080),
  ('b0000000-0000-4000-8000-00000000000a', 3, 480, 1080),
  ('b0000000-0000-4000-8000-00000000000a', 4, 480, 1080),
  ('b0000000-0000-4000-8000-00000000000a', 5, 480, 1080)
on conflict (employee_id, day_of_week) do nothing;

-- -----------------------------------------------------------------------------
-- Favorites for demo consumer
-- -----------------------------------------------------------------------------

insert into public.favorites (user_id, provider_id) values
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003'),
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000008')
on conflict (user_id, provider_id) do nothing;

-- -----------------------------------------------------------------------------
-- Upcoming appointments (relative to seed time)
-- -----------------------------------------------------------------------------

insert into public.appointments (
  id, user_id, provider_id, service_name, starts_at, ends_at, status, location, notes
) values
  (
    'c0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001',
    'Initial Consultation',
    timezone('utc', now()) + interval '1 day' + interval '10 hours 30 minutes',
    timezone('utc', now()) + interval '1 day' + interval '11 hours',
    'confirmed',
    '1200 Market St, Suite 400, San Francisco, CA',
    'First visit — mild eczema on arms.'
  ),
  (
    'c0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000002',
    'The Signature Cut',
    timezone('utc', now()) + interval '3 days' + interval '15 hours',
    timezone('utc', now()) + interval '3 days' + interval '15 hours 45 minutes',
    'confirmed',
    '88 Valencia St, San Francisco, CA',
  null
  ),
  (
    'c0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000003',
    'Deep Tissue Massage',
    timezone('utc', now()) + interval '5 days' + interval '11 hours',
    timezone('utc', now()) + interval '5 days' + interval '12 hours',
    'pending',
    '450 Hayes St, San Francisco, CA',
    'Focus on lower back and shoulders.'
  ),
  (
    'c0000000-0000-4000-8000-000000000004',
    'a0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000007',
    'Injury Assessment',
    timezone('utc', now()) + interval '8 days' + interval '9 hours',
    timezone('utc', now()) + interval '8 days' + interval '9 hours 30 minutes',
    'confirmed',
    '1 Warriors Way, Suite 210, San Francisco, CA',
    'Right knee discomfort after running.'
  ),
  (
    'c0000000-0000-4000-8000-000000000005',
    'a0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000009',
    'Airport Transfer',
    timezone('utc', now()) + interval '12 days' + interval '6 hours',
    timezone('utc', now()) + interval '12 days' + interval '7 hours 15 minutes',
    'confirmed',
    'Pickup: 123 Demo St, SF → SFO Terminal 2',
    'Flight at 9:15 AM — 2 passengers, 2 bags.'
  ),
  (
    'c0000000-0000-4000-8000-000000000006',
    'a0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-00000000000a',
    'Standard Home Clean',
    timezone('utc', now()) + interval '14 days' + interval '10 hours',
    timezone('utc', now()) + interval '14 days' + interval '13 hours',
    'pending',
    '123 Demo St, San Francisco, CA',
    '2 bed / 1 bath. Please use eco products only.'
  )
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Conversations + messages (inbox previews; trigger syncs last_message_*)
-- -----------------------------------------------------------------------------

insert into public.conversations (id, user_id, provider_id) values
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002'),
  ('d0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003')
on conflict (user_id, provider_id) do nothing;

insert into public.messages (id, conversation_id, sender_id, body, created_at) values
  (
    'e0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001',
    'Hi Alex! I''ve confirmed your consultation for tomorrow. Please arrive 10 minutes early to complete intake forms.',
    timezone('utc', now()) - interval '2 hours'
  ),
  (
    'e0000000-0000-4000-8000-000000000002',
    'd0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    'Thanks Dr. Sterling — see you then!',
    timezone('utc', now()) - interval '1 hour 50 minutes'
  ),
  (
    'e0000000-0000-4000-8000-000000000003',
    'd0000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000002',
    'Your Signature Cut is booked. Want a hot towel add-on this time?',
    timezone('utc', now()) - interval '1 day'
  ),
  (
    'e0000000-0000-4000-8000-000000000004',
    'd0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000001',
    'Hi Sophia — deep tissue please, lower back has been tight.',
    timezone('utc', now()) - interval '3 hours'
  ),
  (
    'e0000000-0000-4000-8000-000000000005',
    'd0000000-0000-4000-8000-000000000003',
    'b0000000-0000-4000-8000-000000000003',
    'Got it! I''ll focus on your lower back and shoulders. See you Friday.',
    timezone('utc', now()) - interval '2 hours 30 minutes'
  )
on conflict (id) do nothing;
