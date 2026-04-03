create table if not exists public.user_profiles (
  user_id text primary key,
  unique_identifier text not null,
  user_config jsonb not null default '{}'::jsonb,
  source_profile_file text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

