-- FitPilot migration 006 — track scheduled sessions + offline-safe dedupe.
-- Run the whole file in Supabase -> SQL Editor.
--
-- Adds:
--  * source: how the row was created ('manual' = user tapped an outcome in the
--    app; 'auto_miss' = the app backfilled a missed scheduled day).
--  * session_date: the calendar date the row is FOR (not when it was sent), so
--    we can dedupe and compute adherence per scheduled day.
--  * a unique (user_id, session_date, item_title) key so retries after an
--    unconfirmed send can't create duplicates.

alter table public.adherence_logs
  add column if not exists source text
    check (source in ('manual','auto_miss')) default 'manual';

alter table public.adherence_logs
  add column if not exists session_date date;

-- Backfill session_date for existing rows from logged_at.
update public.adherence_logs
  set session_date = (logged_at at time zone 'UTC')::date
  where session_date is null;

-- One row per user per scheduled session per day. ON CONFLICT DO NOTHING in the
-- client insert makes retries idempotent.
create unique index if not exists adherence_unique_session
  on public.adherence_logs (user_id, session_date, item_title);
