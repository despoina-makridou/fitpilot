-- FitPilot migration 003 — fitness level, training days, equipment.
-- Run the WHOLE file at once in Supabase -> SQL Editor.

alter table public.profiles add column if not exists fitness_level text
  check (fitness_level in ('beginner','intermediate','advanced'));
alter table public.profiles add column if not exists days_per_week int
  check (days_per_week between 1 and 7);
-- Equipment the user has available (array of ids from the app's Equipment type).
alter table public.profiles add column if not exists equipment text[];
