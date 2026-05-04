-- Fields collected on mobile onboarding (align with app/onboarding + authProfile upsert)
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists age integer,
  add column if not exists chronic_conditions text[] not null default '{}';
