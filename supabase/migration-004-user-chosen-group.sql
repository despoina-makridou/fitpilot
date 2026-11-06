-- FitPilot migration 004 — let the USER choose their study group at signup
-- (instead of server auto-balancing). Run the whole file in the SQL Editor.

-- Creates the caller's profile with a caller-specified group. Idempotent:
-- if a profile already exists it is returned unchanged. SECURITY DEFINER so it
-- can insert past RLS, but it only ever acts on auth.uid() (the caller), so a
-- user can only create their OWN profile.
create or replace function public.create_profile_with_group(p_group text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing public.profiles;
  created public.profiles;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_group not in ('ai', 'non_ai') then
    raise exception 'invalid group %', p_group;
  end if;

  select * into existing from public.profiles where id = uid;
  if found then
    return existing;
  end if;

  insert into public.profiles (id, "group")
  values (uid, p_group)
  returning * into created;

  return created;
end;
$$;

grant execute on function public.create_profile_with_group(text) to authenticated;
