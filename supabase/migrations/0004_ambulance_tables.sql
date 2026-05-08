-- Ambulance service tables for Rapha
-- Apply: supabase db push  OR paste into Supabase SQL editor

-- Device registry (one row per physical ambulance device)
create table if not exists public.ambulance_devices (
  id            uuid primary key default gen_random_uuid(),
  pairing_code  text unique not null,          -- e.g. "RA-A3F7B2"
  vehicle_plate text,
  hospital_name text,
  driver_name   text,
  driver_phone  text,
  status        text not null default 'offline', -- 'active' | 'offline'
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Location heartbeat (insert every 30s when online)
create table if not exists public.ambulance_device_sessions (
  id          uuid primary key default gen_random_uuid(),
  device_id   uuid not null references public.ambulance_devices(id) on delete cascade,
  latitude    double precision not null,
  longitude   double precision not null,
  last_ping   timestamptz not null default now()
);

-- Emergency dispatch requests
create table if not exists public.ambulance_requests (
  id               uuid primary key default gen_random_uuid(),
  device_id        uuid references public.ambulance_devices(id),
  patient_user_id  uuid references auth.users(id),
  triage_summary   text,
  severity         text,                        -- 'critical' | 'urgent' | 'mild'
  destination_name text,
  status           text not null default 'pending',
    -- pending | dispatched | arrived | transporting | completed | declined
  dispatched_at    timestamptz,
  arrived_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);

-- RLS: ambulance data is not tied to auth.uid() in the usual way.
-- Enable RLS but allow service-role reads for the edge function.
alter table public.ambulance_devices enable row level security;
alter table public.ambulance_device_sessions enable row level security;
alter table public.ambulance_requests enable row level security;

-- Public read for pairing validation (sign-in flow checks pairing_code)
create policy "ambulance_devices_public_read"
  on public.ambulance_devices for select
  using (true);

-- Service role (edge functions) can do everything
create policy "ambulance_devices_service_all"
  on public.ambulance_devices for all
  using (auth.role() = 'service_role');

create policy "ambulance_sessions_service_all"
  on public.ambulance_device_sessions for all
  using (auth.role() = 'service_role');

-- Allow insert for location heartbeat without service role (device client)
create policy "ambulance_sessions_insert"
  on public.ambulance_device_sessions for insert
  with check (true);

create policy "ambulance_requests_service_all"
  on public.ambulance_requests for all
  using (auth.role() = 'service_role');

create policy "ambulance_requests_device_read"
  on public.ambulance_requests for select
  using (true);

create policy "ambulance_requests_device_update"
  on public.ambulance_requests for update
  using (true);

-- Seed one demo device for testing
insert into public.ambulance_devices (pairing_code, vehicle_plate, hospital_name, driver_name, driver_phone)
values ('RA-DEMO01', 'ET-AA-12345', 'Black Lion Hospital', 'Test Driver', '+251911000000')
on conflict (pairing_code) do nothing;
