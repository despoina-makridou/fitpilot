-- FitPilot migration 008 — end-of-trial questionnaire (DB-defined questions).
-- Run the whole file in Supabase -> SQL Editor.
--
-- Questions live in the DB so you can finalize them LATER (within the 15-day
-- window) by inserting rows — no app rebuild needed. The app fetches active
-- questions at trial end, renders them, and saves answers.

-- ---------------------------------------------------------------------------
-- questionnaire_questions: the survey definition (you fill this in later)
-- ---------------------------------------------------------------------------
create table if not exists public.questionnaire_questions (
  id         uuid primary key default gen_random_uuid(),
  ordinal    int  not null default 0,          -- display order
  qtype      text not null check (qtype in ('scale','choice','text')),
  prompt     text not null,                     -- the question text
  options    jsonb,                             -- for 'choice': ["A","B",...]; scale can set {"min":1,"max":5}
  required   boolean not null default true,
  active     boolean not null default true,     -- toggle a question on/off
  created_at timestamptz not null default now()
);

-- Everyone (any authenticated user) may READ the active questions.
alter table public.questionnaire_questions enable row level security;
drop policy if exists "read active questions" on public.questionnaire_questions;
create policy "read active questions" on public.questionnaire_questions
  for select using (active = true);
-- (You insert/edit questions from the dashboard as the table owner; no client
--  write policy is granted on purpose.)

-- ---------------------------------------------------------------------------
-- questionnaire_responses: one row per (user, question) answer
-- ---------------------------------------------------------------------------
create table if not exists public.questionnaire_responses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  "group"     text,                             -- arm snapshot, for analysis
  question_id uuid not null references public.questionnaire_questions (id) on delete cascade,
  answer      text,                             -- scale -> "4", choice -> the option, text -> free text
  answered_at timestamptz not null default now(),
  unique (user_id, question_id)                 -- one answer per question per user
);

create index if not exists qresp_user_idx on public.questionnaire_responses (user_id);

alter table public.questionnaire_responses enable row level security;
drop policy if exists "own responses - select" on public.questionnaire_responses;
create policy "own responses - select" on public.questionnaire_responses
  for select using (auth.uid() = user_id);
drop policy if exists "own responses - insert" on public.questionnaire_responses;
create policy "own responses - insert" on public.questionnaire_responses
  for insert with check (auth.uid() = user_id);
drop policy if exists "own responses - update" on public.questionnaire_responses;
create policy "own responses - update" on public.questionnaire_responses
  for update using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Mark on the profile when the user finished the questionnaire.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists questionnaire_done_at timestamptz;

-- ---------------------------------------------------------------------------
-- EXAMPLE questions (commented out). Uncomment / edit / add your own later:
-- ---------------------------------------------------------------------------
-- insert into public.questionnaire_questions (ordinal, qtype, prompt, options) values
--   (1, 'scale',  'How motivated did you feel to exercise during the study?', '{"min":1,"max":5}'),
--   (2, 'scale',  'How helpful were the app''s reminders?',                    '{"min":1,"max":5}'),
--   (3, 'choice', 'Did you feel the app helped you stick to your schedule?',   '["Yes, a lot","Somewhat","Not really","No"]'),
--   (4, 'text',   'Any comments about your experience?', null);
