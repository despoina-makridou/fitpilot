-- FitPilot migration 002 — run the WHOLE file at once, in a fresh query.
-- Correct order: DROP old constraint -> fix data -> ADD new constraint -> columns.

-- Step 1: DROP the old goal constraint FIRST (it still allows only the old
-- values, which blocks us from writing 'lose_fat' below).
alter table public.profiles drop constraint if exists profiles_goal_check;

-- Step 2: now that nothing blocks it, normalize old goal values to the new set.
update public.profiles set goal = 'lose_fat' where goal = 'lose_weight';
update public.profiles set goal = null
  where goal is not null
    and goal not in ('lose_fat','gain_weight','build_muscle','endurance','maintain');

-- Step 3: add the new goal constraint.
alter table public.profiles
  add constraint profiles_goal_check
  check (goal is null or goal in ('lose_fat','gain_weight','build_muscle','endurance','maintain'));

-- Step 4: add the new columns.
alter table public.profiles add column if not exists name         text;
alter table public.profiles add column if not exists age          int;
alter table public.profiles add column if not exists sex          text check (sex in ('male','female','other'));
alter table public.profiles add column if not exists height_cm    numeric;
alter table public.profiles add column if not exists weight_kg    numeric;
alter table public.profiles add column if not exists goal_details jsonb;
