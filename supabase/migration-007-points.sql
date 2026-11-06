-- FitPilot migration 007 — store per-session points on each adherence log.
-- Run the whole file in Supabase -> SQL Editor.
--
-- points = base + streak, where:
--   base   = round(min(minutes/target,1)*10)   (0..10, % of target done)
--   streak = the Nth effort-session bonus in the rolling 7-day window (0,1,2..)
-- Total points per user is just sum(points).

alter table public.adherence_logs add column if not exists points int not null default 0;
alter table public.adherence_logs add column if not exists base_points int not null default 0;
alter table public.adherence_logs add column if not exists streak_bonus int not null default 0;

-- Running total per user, kept in sync by a trigger so it always equals
-- sum(points) of that user's logs (survives inserts, updates, deletes).
alter table public.profiles add column if not exists total_points int not null default 0;

create or replace function public.sync_total_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
begin
  target_user := coalesce(new.user_id, old.user_id);
  update public.profiles p
    set total_points = coalesce((
      select sum(l.points) from public.adherence_logs l where l.user_id = target_user
    ), 0)
    where p.id = target_user;
  return null;
end;
$$;

drop trigger if exists trg_sync_total_points on public.adherence_logs;
create trigger trg_sync_total_points
  after insert or update or delete on public.adherence_logs
  for each row execute function public.sync_total_points();

-- Backfill totals for any existing rows.
update public.profiles p
  set total_points = coalesce((
    select sum(l.points) from public.adherence_logs l where l.user_id = p.id
  ), 0);
