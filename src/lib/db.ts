import { supabase } from './supabase';
import {
  AdherenceLog,
  Goal,
  GoalDetails,
  Outcome,
  Profile,
  StudyGroup,
  TemplateItem,
  UserInfo,
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
 * balanced way. Group assignment is done server-side via the assign_group()
 * RPC so two simultaneous signups can't both read stale counts and unbalance
 * the arms (see supabase/schema.sql). Returns the (possibly newly created)
 * profile.
 */
export async function ensureProfile(userId: string): Promise<Profile> {
  const existing = await getProfile(userId);
  if (existing) return existing;

  // Atomic, race-safe: counts arms and inserts into the smaller one.
  const { data, error } = await supabase.rpc('assign_group_and_create_profile');
  if (error) throw error;
  // The RPC returns the created profile row.
  return data as Profile;
}

export async function saveConsent(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ consented_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

/** Save the personal-info step (name/age/sex/height/weight/level/days). */
export async function saveUserInfo(userId: string, info: UserInfo): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      name: info.name,
      age: info.age,
      sex: info.sex,
      height_cm: info.height_cm,
      weight_kg: info.weight_kg,
      fitness_level: info.fitness_level,
      days_per_week: info.days_per_week,
    })
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
