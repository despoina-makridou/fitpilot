-- ============================================================================
-- FitPilot — Supabase schema
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================================
-- This app is a research instrument comparing an AI arm vs a non-AI arm on
-- workout-schedule adherence. We store only: which group a user is in, their
-- goal, and adherence logs (did / partial / skipped + minutes).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  "group"       text not null check ("group" in ('ai', 'non_ai')),
  goal          text check (goal in ('lose_weight','gain_weight','build_muscle','maintain')),
  consented_at  timestamptz,
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- adherence_logs: the core measurement
-- ---------------------------------------------------------------------------
create table if not exists public.adherence_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  "group"        text not null check ("group" in ('ai','non_ai')),
  goal           text,
  day            int  not null check (day between 0 and 6),
  item_title     text not null,
  outcome        text not null check (outcome in ('completed','partial','skipped')),
  minutes        int  not null default 0,
  target_minutes int  not null default 0,
  logged_at      timestamptz not null default now()
);

create index if not exists adherence_logs_user_idx on public.adherence_logs (user_id);
create index if not exists adherence_logs_group_idx on public.adherence_logs ("group");

-- ---------------------------------------------------------------------------
-- Row Level Security: each user can only see / write their own rows.
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.adherence_logs enable row level security;

drop policy if exists "own profile - select" on public.profiles;
create policy "own profile - select" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "own profile - update" on public.profiles;
create policy "own profile - update" on public.profiles
  for update using (auth.uid() = id);

-- NOTE: we intentionally do NOT allow direct client INSERT into profiles.
-- Profiles are created only through assign_group_and_create_profile() below,
-- which runs with elevated rights and controls group balancing.

drop policy if exists "own logs - select" on public.adherence_logs;
create policy "own logs - select" on public.adherence_logs
  for select using (auth.uid() = user_id);

drop policy if exists "own logs - insert" on public.adherence_logs;
create policy "own logs - insert" on public.adherence_logs
  for insert with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Balanced group assignment (race-safe).
--
-- Called once per user right after signup. It locks the profiles table so two
-- concurrent signups can't both read the same counts, counts each arm, and
-- assigns the new user to the SMALLER arm (ties -> 'ai'). Idempotent: if the
-- caller already has a profile it just returns it.
--
-- SECURITY DEFINER lets it insert into profiles despite RLS; it only ever
-- acts on auth.uid(), so a user can only create their own profile.
-- ---------------------------------------------------------------------------
create or replace function public.assign_group_and_create_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing public.profiles;
  ai_count int;
  non_ai_count int;
  chosen text;
  created public.profiles;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Return existing profile if present (idempotent).
  select * into existing from public.profiles where id = uid;
  if found then
    return existing;
  end if;

  -- Serialize assignment across concurrent signups.
  lock table public.profiles in share row exclusive mode;

  select count(*) into ai_count     from public.profiles where "group" = 'ai';
  select count(*) into non_ai_count from public.profiles where "group" = 'non_ai';

  if ai_count <= non_ai_count then
    chosen := 'ai';
  else
    chosen := 'non_ai';
  end if;

  insert into public.profiles (id, "group")
  values (uid, chosen)
  returning * into created;

  return created;
end;
$$;

grant execute on function public.assign_group_and_create_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- Convenience view for YOUR analysis (adherence rate per group).
-- Query it in the SQL editor when the trial ends.
-- ---------------------------------------------------------------------------
create or replace view public.adherence_summary as
select
  "group",
  count(*)                                              as total_sessions,
  count(*) filter (where outcome = 'completed')         as completed,
  count(*) filter (where outcome = 'partial')           as partial,
  count(*) filter (where outcome = 'skipped')           as skipped,
  round(
    100.0 * count(*) filter (where outcome = 'completed') / nullif(count(*), 0),
    1
  )                                                      as completed_pct
from public.adherence_logs
group by "group";
