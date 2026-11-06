-- ============================================================================
-- FitPilot — SEED FAKE STUDY DATA (app-accurate)
-- 20 participants (10 ai + 10 non_ai), 10 days each.
-- Mirrors how the APP writes: per-exercise varying targets, correct
-- base/streak/points math, manual vs auto_miss, nickname (cloud), personal
-- data NOT stored (on-device only). total_points is synced by the trigger.
--
-- Run in Supabase -> SQL Editor. Safe to re-run (clears its own fake rows).
-- Remove later:  delete from auth.users where email like 'fake+%@fitpilot.test';
-- ============================================================================

delete from auth.users where email like 'fake+%@fitpilot.test';

do $$
declare
  n_ai       int := 10;
  n_nonai    int := 10;
  days       int := 10;
  i          int;
  d          int;
  uid        uuid;
  grp        text;
  gl         text;
  p          numeric;      -- completion probability for this user
  roll       numeric;
  outcome    text;
  mins       int;
  tgt        int;
  ex         text;
  base       int;
  streak     int;
  pts        int;
  effort_ct  int;          -- effort sessions so far in current 7-day window
  cur_window int;
  started    timestamptz;
  sess_ts    timestamptz;

  goals text[] := array['build_muscle','lose_fat','endurance','gain_weight','maintain'];
  -- pool of (exercise, target) pairs like the app's suggestedMinutes heuristic
  exs   text[] := array['Running','Push-ups','Squats','Dumbbell press','Planks','Cycling','Pull-ups','Burpees'];
  tgts  int[]  := array[30,      10,        10,      10,             3,       30,       10,        20];
begin
  for i in 1..(n_ai + n_nonai) loop
    uid := gen_random_uuid();
    if i <= n_ai then grp := 'ai'; else grp := 'non_ai'; end if;
    gl  := goals[1 + (i % 5)];
    -- AI arm adheres a bit better (the hypothesis). Add per-user spread.
    if grp = 'ai' then p := 0.62 + (i % 5) * 0.05;   -- ~0.62..0.82
    else                p := 0.38 + (i % 5) * 0.05;  -- ~0.38..0.58
    end if;

    started := now() - (interval '1 day' * days);

    -- Auth user (minimal, just for the FK + a visible email).
    insert into auth.users (id, instance_id, aud, role, email,
                            encrypted_password, email_confirmed_at,
                            created_at, updated_at)
    values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'fake+' || i || '@fitpilot.test',
            crypt('pw', gen_salt('bf')), now(), started, started);

    -- Cloud profile: STUDY DATA ONLY (nickname/group/goal/equipment). No
    -- personal/health fields — those live on-device in the real app.
    insert into public.profiles (id, "group", goal, nickname, equipment,
                                 goal_details, consented_at, onboarded_at, created_at)
    values (uid, grp, gl,
            (case when grp='ai' then 'AI-' else 'STD-' end) || lpad(i::text, 2, '0'),
            array['open_space','dumbbells','running_area'],
            '{}'::jsonb, started, started, started);

    effort_ct := 0;
    cur_window := 0;

    for d in 0..(days - 1) loop
      -- reset the streak counter at each new 7-day window from start
      if (d / 7) <> cur_window then
        cur_window := d / 7;
        effort_ct := 0;
      end if;

      -- pick an exercise + its target for this day
      ex  := exs[1 + (d % array_length(exs, 1))];
      tgt := tgts[1 + (d % array_length(tgts, 1))];
      sess_ts := started + (interval '1 day' * d) + interval '17 hours';

      roll := random();
      if roll < p then
        outcome := 'completed';
        mins := tgt - floor(random()*3)::int;           -- near/at target
      elsif roll < p + 0.15 then
        outcome := 'partial';
        mins := greatest(1, floor(tgt * (0.2 + random()*0.5))::int); -- some
      else
        outcome := 'skipped';
        mins := 0;
      end if;

      -- points math (same as src/lib/points.ts)
      if mins > 0 then
        base   := round(least(mins::numeric / tgt, 1) * 10);
        streak := effort_ct;            -- 1st effort -> +0, 2nd -> +1, ...
        effort_ct := effort_ct + 1;
      else
        base := 0; streak := 0;
      end if;
      pts := base + streak;

      insert into public.adherence_logs
        (user_id, "group", goal, day, item_title, outcome, minutes,
         target_minutes, points, base_points, streak_bonus, source,
         session_date, logged_at)
      values
        (uid, grp, gl, d % 7, ex, outcome, mins, tgt, pts, base, streak,
         case when outcome='skipped' then 'auto_miss' else 'manual' end,
         (sess_ts at time zone 'UTC')::date, sess_ts);
    end loop;
  end loop;
end $$;

-- total_points is maintained by the trigger on insert; this is just a safety
-- re-sync in case the trigger wasn't present when seeding.
update public.profiles p
  set total_points = coalesce((
    select sum(l.points) from public.adherence_logs l where l.user_id = p.id
  ), 0)
  where p.nickname like 'AI-%' or p.nickname like 'STD-%';
