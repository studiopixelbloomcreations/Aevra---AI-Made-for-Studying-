create table if not exists public.user_profiles (
  user_id text primary key,
  personalization_data jsonb not null default '{}'::jsonb,
  ai_config jsonb not null default '{}'::jsonb,
  unique_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles
  add column if not exists personalization_data jsonb not null default '{}'::jsonb;

alter table public.user_profiles
  add column if not exists ai_config jsonb not null default '{}'::jsonb;

alter table public.user_profiles
  add column if not exists unique_id text;

alter table public.user_profiles
  add column if not exists created_at timestamptz not null default now();

alter table public.user_profiles
  add column if not exists updated_at timestamptz not null default now();

update public.user_profiles
set
  personalization_data = coalesce(personalization_data, user_config, '{}'::jsonb),
  ai_config = coalesce(ai_config, (user_config->'ai_behavior'), '{}'::jsonb),
  unique_id = coalesce(nullif(unique_id, ''), nullif(unique_identifier, ''), user_id || '_' || extract(epoch from now())::bigint::text)
where true;

alter table public.user_profiles
  alter column unique_id set not null;
