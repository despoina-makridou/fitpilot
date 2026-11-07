import { supabase } from './supabase';
import {
  AdherenceLog,
  Goal,
  GoalDetails,
  Outcome,
  Profile,
  Question,
  StudyGroup,
  TemplateItem,
} from '../types';

/**
 * Fetch the current user's profile, or null if none exists yet.
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile) ?? null;
}

/**
 * Ensure a profile row exists for this user, assigning a study group in a
 * balanced way server-side (assign_group_and_create_profile RPC): counts the
 * two arms and puts the new user in the smaller one, atomically, so concurrent
 * signups can't unbalance the study. Returns the (possibly newly created)
 * profile.
 */
export async function ensureProfile(userId: string): Promise<Profile> {
  const existing = await getProfile(userId);
  if (existing) return existing;

  const { data, error } = await supabase.rpc('assign_group_and_create_profile');
  if (error) throw error;
  return data as Profile;
}

export async function saveConsent(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ consented_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

/**
 * Save the user's chosen nickname to the CLOUD. Personal info (age/height/
 * weight/etc.) is NOT sent here — it's stored locally on the device only
 * (see saveLocalProfile). The nickname is a non-identifying study label.
 */
export async function saveNickname(userId: string, nickname: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ nickname })
    .eq('id', userId);
  if (error) throw error;
}

/** Save the equipment the user has available. */
export async function saveEquipment(userId: string, equipment: string[]): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ equipment })
    .eq('id', userId);
  if (error) throw error;
}

/** Save goal + its follow-up answers, and finish onboarding. */
export async function saveGoalAndFinishOnboarding(
  userId: string,
  goal: Goal,
  details: GoalDetails,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      goal,
      goal_details: details,
      onboarded_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) throw error;
}

/**
 * Write one adherence log — the core study measurement.
 */
export async function logAdherence(params: {
  userId: string;
  group: StudyGroup;
  goal: Goal | null;
  item: TemplateItem;
  outcome: Outcome;
  minutes: number;
}): Promise<void> {
  const row: AdherenceLog = {
    user_id: params.userId,
    group: params.group,
    goal: params.goal,
    day: params.item.day,
    item_title: params.item.title,
    outcome: params.outcome,
    minutes: params.minutes,
    target_minutes: params.item.targetMinutes,
    logged_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('adherence_logs').insert(row);
  if (error) throw error;
}

/**
 * Fetch the set of session keys ('YYYY-MM-DD|item_title') the user already has
 * logged in the cloud, over the last `days` days. Used by the backfill so we
 * never overwrite a real log with an auto-miss.
 */
export async function fetchLoggedKeys(userId: string, days = 21): Promise<Set<string>> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from('adherence_logs')
    .select('session_date,item_title,logged_at')
    .eq('user_id', userId)
    .gte('logged_at', since.toISOString());
  if (error) throw error;
  const set = new Set<string>();
  for (const r of (data as any[]) ?? []) {
    const date = r.session_date ?? (r.logged_at ? String(r.logged_at).slice(0, 10) : null);
    if (date) set.add(`${date}|${r.item_title}`);
  }
  return set;
}

/** Fetch the active questionnaire questions (ordered). Empty = not ready yet. */
export async function fetchQuestions(): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questionnaire_questions')
    .select('id, ordinal, qtype, prompt, options, required')
    .eq('active', true)
    .order('ordinal', { ascending: true });
  if (error) throw error;
  return (data as Question[]) ?? [];
}

/** Save the user's questionnaire answers and mark the questionnaire complete. */
export async function submitQuestionnaire(
  userId: string,
  group: StudyGroup,
  answers: { question_id: string; answer: string }[],
): Promise<void> {
  if (answers.length) {
    const rows = answers.map((a) => ({
      user_id: userId,
      group,
      question_id: a.question_id,
      answer: a.answer,
      answered_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from('questionnaire_responses')
      .upsert(rows, { onConflict: 'user_id,question_id' });
    if (error) throw error;
  }
  const { error: pErr } = await supabase
    .from('profiles')
    .update({ questionnaire_done_at: new Date().toISOString() })
    .eq('id', userId);
  if (pErr) throw pErr;
}

/** Recent adherence logs for the current user (for the home summary). */
export async function recentLogs(userId: string, limit = 20): Promise<AdherenceLog[]> {
  const { data, error } = await supabase
    .from('adherence_logs')
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as AdherenceLog[]) ?? [];
}
