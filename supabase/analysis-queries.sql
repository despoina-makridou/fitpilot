-- ============================================================================
-- FitPilot — ANALYSIS QUERIES
-- Run these in Supabase -> SQL Editor to pull your study results.
-- ============================================================================

-- ── 1) THE HEADLINE: adherence per arm (AI vs non-AI) ──────────────────────
-- This is your main result. Because the app now records BOTH what was done AND
-- auto-misses for scheduled sessions, total_sessions here = scheduled sessions,
-- so completed_pct is a TRUE adherence rate (completed ÷ scheduled) — fair
-- across users who train 1x vs 4x per week.
select
  "group",
  count(distinct user_id)                                as participants,
  count(*)                                               as scheduled_sessions,
  count(*) filter (where outcome = 'completed')          as completed,
  count(*) filter (where outcome = 'partial')            as partial,
  count(*) filter (where outcome = 'skipped')            as skipped,
  count(*) filter (where source = 'auto_miss')           as auto_misses,
  round(100.0 * count(*) filter (where outcome='completed')
        / nullif(count(*),0), 1)                         as adherence_pct
from public.adherence_logs
group by "group"
order by "group";


-- ── 2) Per-participant breakdown ───────────────────────────────────────────
-- See each person's adherence, so you can spot outliers.
select
  p.nickname,
  p."group",
  p.goal,
  count(l.*)                                             as sessions,
  count(l.*) filter (where l.outcome='completed')        as completed,
  round(100.0 * count(l.*) filter (where l.outcome='completed')
        / nullif(count(l.*),0), 1)                       as completed_pct,
  round(avg(l.minutes),1)                                as avg_minutes
from public.profiles p
left join public.adherence_logs l on l.user_id = p.id
group by p.nickname, p."group", p.goal
order by p."group", completed_pct desc;


-- ── 3) Minutes actually done vs target (effort, not just did/didn't) ────────
select
  "group",
  round(avg(minutes), 1)                                 as avg_minutes_done,
  round(avg(target_minutes), 1)                          as avg_target,
  round(100.0 * avg(minutes) / nullif(avg(target_minutes),0), 1)
                                                         as pct_of_target
from public.adherence_logs
where outcome <> 'skipped'
group by "group";


-- ── 4) Adherence over time (weekly trend per arm) ──────────────────────────
-- Did the AI arm hold up better over the weeks? (drop-off analysis)
select
  "group",
  date_trunc('week', logged_at)::date                    as week,
  count(*)                                               as sessions,
  round(100.0 * count(*) filter (where outcome='completed')
        / nullif(count(*),0), 1)                         as completed_pct
from public.adherence_logs
group by "group", week
order by week, "group";


-- ── 4b) Points per arm + leaderboard ───────────────────────────────────────
-- Average points per user by arm (does the AI arm earn more / stay engaged?).
select
  "group",
  count(*)                          as participants,
  round(avg(total_points), 1)       as avg_total_points,
  max(total_points)                 as top_points
from public.profiles
group by "group"
order by "group";

-- Individual leaderboard.
select nickname, "group", goal, total_points
from public.profiles
order by total_points desc;


-- ── 5) Raw dump (everything, newest first) ─────────────────────────────────
-- The full table if you want to export to CSV for stats software (SPSS, R...).
select p.nickname, l."group", l.goal, l.item_title, l.outcome,
       l.minutes, l.target_minutes, l.logged_at
from public.adherence_logs l
join public.profiles p on p.id = l.user_id
order by l.logged_at desc;
