-- Repair partial or hand-rolled `profiles` tables (fixes PostgREST PGRST204 e.g. missing current_medications).
-- Safe to run on projects that already applied 0001/0002: every line uses IF NOT EXISTS.

alter table public.profiles add column if not exists allergies text[] not null default '{}';
alter table public.profiles add column if not exists current_medications text[] not null default '{}';
alter table public.profiles add column if not exists blood_type text;
alter table public.profiles add column if not exists emergency_contact_name text;
alter table public.profiles add column if not exists emergency_contact_phone text;
alter table public.profiles add column if not exists caregiver_contacts jsonb not null default '[]';
alter table public.profiles add column if not exists location_consent boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists age integer;
alter table public.profiles add column if not exists chronic_conditions text[] not null default '{}';
