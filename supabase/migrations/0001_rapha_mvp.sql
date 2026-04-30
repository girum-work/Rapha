create extension if not exists "pgcrypto";

create type public.session_status as enum ('active', 'deferred', 'completed');
create type public.triage_severity as enum ('critical', 'urgent', 'mild');
create type public.triage_action as enum ('ask_more', 'emergency', 'hospital', 'clinic', 'pharmacy', 'first_aid', 'self_care');
create type public.message_role as enum ('user', 'assistant', 'system');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  allergies text[] not null default '{}',
  current_medications text[] not null default '{}',
  blood_type text,
  emergency_contact_name text,
  emergency_contact_phone text,
  caregiver_contacts jsonb not null default '[]',
  location_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  type text not null check (type in ('hospital', 'clinic')),
  address text not null,
  neighborhood text not null,
  phone text,
  latitude double precision not null,
  longitude double precision not null,
  capability_tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.pharmacies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  neighborhood text not null,
  phone text,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now()
);

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.session_status not null default 'active',
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deferred_until timestamptz,
  final_severity public.triage_severity,
  final_action public.triage_action,
  selected_facility_id uuid references public.facilities(id),
  selected_pharmacy_id uuid references public.pharmacies(id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role public.message_role not null,
  content text not null,
  structured_response jsonb,
  created_at timestamptz not null default now()
);

create table public.triage_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  conditions jsonb not null default '[]',
  confidence numeric(4,3),
  red_flags text[] not null default '{}',
  severity public.triage_severity not null,
  action public.triage_action not null,
  disclaimer text not null,
  raw_model_response jsonb not null,
  created_at timestamptz not null default now()
);

create table public.pharmacy_stock (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  drug_name text not null,
  brand_name text,
  quantity integer not null default 0 check (quantity >= 0),
  unit text not null,
  last_updated timestamptz not null default now()
);

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.chat_sessions(id) on delete set null,
  image_path text,
  ocr_text text,
  extracted_medications jsonb not null default '[]',
  matched_pharmacy_id uuid references public.pharmacies(id),
  created_at timestamptz not null default now()
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.chat_sessions(id) on delete set null,
  request_type text not null check (request_type in ('hospital', 'ambulance', 'transport', 'pharmacy')),
  status text not null default 'simulated' check (status in ('simulated', 'pending', 'confirmed', 'cancelled', 'completed')),
  destination_facility_id uuid references public.facilities(id),
  destination_pharmacy_id uuid references public.pharmacies(id),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.chat_sessions(id) on delete cascade,
  notification_type text not null default 'deferred_care',
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  response text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.triage_results enable row level security;
alter table public.prescriptions enable row level security;
alter table public.service_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.facilities enable row level security;
alter table public.pharmacies enable row level security;
alter table public.pharmacy_stock enable row level security;

create policy "Users manage own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users manage own sessions" on public.chat_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users read own messages" on public.chat_messages for select using (
  exists (select 1 from public.chat_sessions s where s.id = session_id and s.user_id = auth.uid())
);
create policy "Users insert own messages" on public.chat_messages for insert with check (
  exists (select 1 from public.chat_sessions s where s.id = session_id and s.user_id = auth.uid())
);
create policy "Users read own triage" on public.triage_results for select using (
  exists (select 1 from public.chat_sessions s where s.id = session_id and s.user_id = auth.uid())
);
create policy "Users manage own prescriptions" on public.prescriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own service requests" on public.service_requests for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own notifications" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Public read facilities" on public.facilities for select using (true);
create policy "Public read pharmacies" on public.pharmacies for select using (true);
create policy "Public read pharmacy stock" on public.pharmacy_stock for select using (true);

insert into public.facilities (slug, name, type, address, neighborhood, phone, latitude, longitude, capability_tags) values
  ('black-lion', 'Tikur Anbessa Specialized Hospital', 'hospital', 'King George VI Street, Addis Ababa', 'Sidist Kilo', '+251 11 551 1211', 9.0425, 38.7614, array['emergency','cardiology','pediatrics','surgery','lab','pharmacy','general']),
  ('st-pauls', 'St. Paul''s Hospital Millennium Medical College', 'hospital', 'Swaziland Street, Addis Ababa', 'Gulele', '+251 11 275 0125', 9.0677, 38.7258, array['emergency','maternity','pediatrics','surgery','lab','general']),
  ('yekatit-12', 'Yekatit 12 Hospital Medical College', 'hospital', 'Arat Kilo, Addis Ababa', 'Arat Kilo', '+251 11 156 2200', 9.0380, 38.7639, array['emergency','general','surgery','lab','pharmacy']),
  ('zewditu', 'Zewditu Memorial Hospital', 'hospital', 'Ras Desta Damtew Street, Addis Ababa', 'Kirkos', '+251 11 551 8080', 9.0104, 38.7590, array['emergency','general','lab','pharmacy']),
  ('bethel', 'Bethel Teaching General Hospital', 'hospital', 'Tor Hailoch, Addis Ababa', 'Kolfe Keranio', '+251 11 369 1000', 9.0216, 38.7128, array['general','pediatrics','lab','pharmacy']),
  ('landmark', 'Landmark General Hospital', 'hospital', 'Mexico Square, Addis Ababa', 'Mexico', '+251 11 552 5463', 9.0101, 38.7462, array['general','maternity','lab','pharmacy']);

insert into public.pharmacies (slug, name, neighborhood, phone, latitude, longitude) values
  ('teklehaimanot-pharmacy', 'Teklehaimanot Pharmacy', 'Piassa', '+251 11 156 0090', 9.0368, 38.7526),
  ('bole-pharmacy', 'Bole Medhanialem Pharmacy', 'Bole', '+251 11 662 1120', 8.9958, 38.7892),
  ('kazanchis-pharmacy', 'Kazanchis Family Pharmacy', 'Kazanchis', '+251 11 557 4431', 9.0188, 38.7634),
  ('gulele-pharmacy', 'Gulele Community Pharmacy', 'Gulele', '+251 11 275 7781', 9.0594, 38.7383);

insert into public.pharmacy_stock (pharmacy_id, drug_name, brand_name, quantity, unit)
select p.id, s.drug_name, s.brand_name, s.quantity, s.unit
from public.pharmacies p
join (
  values
    ('teklehaimanot-pharmacy', 'paracetamol', 'Para Denk 500mg', 84, 'tablets'),
    ('teklehaimanot-pharmacy', 'oral rehydration salts', 'ORS sachets', 42, 'sachets'),
    ('bole-pharmacy', 'amoxicillin', 'Amoxil 500mg', 18, 'capsules'),
    ('kazanchis-pharmacy', 'cetirizine', 'Cetzine 10mg', 35, 'tablets'),
    ('gulele-pharmacy', 'salbutamol', 'Ventolin inhaler', 7, 'inhalers')
) as s(slug, drug_name, brand_name, quantity, unit) on p.slug = s.slug;
