-- Borderless schema — run in Supabase SQL Editor.
-- Slice 1: profiles only. Groups/teams/meetings/transcripts land in a later migration.

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  language text not null default 'ko',   -- ko | en | vi ...
  job_role text,                         -- 직군: frontend/backend/design/pm ...
  avatar_url text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

-- Any signed-in user can read profiles (names shown across teams).
create policy "profiles_read" on profiles
  for select to authenticated using (true);

-- A user may create and edit only their own profile row.
create policy "profiles_insert_own" on profiles
  for insert to authenticated with check (id = auth.uid());

create policy "profiles_update_own" on profiles
  for update to authenticated using (id = auth.uid());
