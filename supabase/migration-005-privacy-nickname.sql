-- FitPilot migration 005 — privacy: personal data stays on-device.
-- Drop personal/health columns from the CLOUD profiles table and add a
-- non-identifying nickname (the study label). Run the whole file at once.
--
-- Personal info (age/sex/height/weight/fitness level/days) now lives ONLY in
-- the app's local storage on the device (see src/lib/localProfile.ts) and is
-- never sent to Supabase — matching the consent screen's promise.

-- 1) Add the study nickname.
alter table public.profiles add column if not exists nickname text;

-- 2) Remove personal/health columns from the cloud.
alter table public.profiles drop column if exists name;
alter table public.profiles drop column if exists age;
alter table public.profiles drop column if exists sex;
alter table public.profiles drop column if exists height_cm;
alter table public.profiles drop column if exists weight_kg;
alter table public.profiles drop column if exists fitness_level;
alter table public.profiles drop column if exists days_per_week;
