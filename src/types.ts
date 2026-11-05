/** Shared domain types for FitPilot (the study measurement app). */

/** Study arm. Server-assigned at signup to keep groups balanced. */
export type StudyGroup = 'ai' | 'non_ai';

/** The goal the user selects at onboarding; maps to a workout template. */
export type Goal =
  | 'lose_fat'
  | 'gain_weight'
  | 'build_muscle'
  | 'endurance'
  | 'maintain';

/** How each goal's follow-up question behaves. */
export type GoalFollowup = 'target_weight' | 'muscle_focus' | 'frequency';

export const GOALS: {
  id: Goal;
  label: string;
  blurb: string;
  emoji: string;
  followup: GoalFollowup;
}[] = [
  { id: 'build_muscle', label: 'Build muscle mass', blurb: 'Strength & resistance work', emoji: '💪', followup: 'muscle_focus' },
  { id: 'lose_fat', label: 'Lose body fat', blurb: 'Leaner, more cardio + strength', emoji: '🔥', followup: 'target_weight' },
  { id: 'endurance', label: 'Improve endurance', blurb: 'Run, cycle, swim — go longer', emoji: '🏃', followup: 'frequency' },
  { id: 'gain_weight', label: 'Gain healthy body weight', blurb: 'Eat & train to add mass', emoji: '⚖️', followup: 'target_weight' },
  { id: 'maintain', label: 'Stay fit', blurb: 'Keep a steady healthy routine', emoji: '🌿', followup: 'frequency' },
];

export type Sex = 'male' | 'female' | 'other';

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';

export const FITNESS_LEVELS: { id: FitnessLevel; label: string; sub: string }[] = [
  { id: 'beginner', label: 'Beginner', sub: '0–6 months training' },
  { id: 'intermediate', label: 'Intermediate', sub: '6 months–2 years' },
  { id: 'advanced', label: 'Advanced', sub: '2+ years' },
];

/** Personal info collected before goal selection. */
export interface UserInfo {
  name: string;
  age: number;
  sex: Sex;
  height_cm: number;
  weight_kg: number;
  fitness_level: FitnessLevel;
  days_per_week: number; // 2..5 (5 = "5+")
}

/** Goal-specific answers to the follow-up questions. */
export interface GoalDetails {
  /** For lose_fat / gain_weight: their target body weight (kg). */
  target_weight_kg?: number;
  /** For build_muscle: which area to focus on. */
  muscle_focus?: 'full_body' | 'upper' | 'lower';
  /** For endurance / maintain / build_muscle: sessions per week (2..6). */
  days_per_week?: number;
  /** For endurance: preferred activity. */
  endurance_activity?: 'run' | 'cycle' | 'swim' | 'mixed';
}

/** A user's profile row in Supabase. */
export interface Profile {
  id: string; // = auth user id
  group: StudyGroup;
  goal: Goal | null;
  // Personal info (collected at onboarding, usable by the AI coach).
  name: string | null;
  age: number | null;
  sex: Sex | null;
  height_cm: number | null;
  weight_kg: number | null;
  fitness_level: FitnessLevel | null;
  days_per_week: number | null;
  /** Equipment/space the user has (ids from lib/exercises Equipment). */
  equipment: string[] | null;
  // Goal follow-up answers, stored as JSON.
  goal_details: GoalDetails | null;
  consented_at: string | null;
  onboarded_at: string | null;
  created_at: string;
}

/**
 * A single scheduled workout item in a template. Intentionally LOOSE:
 * targets are ranges/alternatives, not clock-strict commitments.
 */
export interface TemplateItem {
  day: number; // 0=Mon .. 6=Sun
  title: string; // e.g. "Cardio"
  /** Human, flexible target — e.g. "~40 min walking or ~20 min running". */
  target: string;
  /** Target minutes used by the timer as a soft goal. */
  targetMinutes: number;
}

export interface WorkoutTemplate {
  goal: Goal;
  name: string;
  items: TemplateItem[];
}

/** How a scheduled session actually went — the adherence signal. */
export type Outcome = 'completed' | 'partial' | 'skipped';

/** One adherence log row written to Supabase. */
export interface AdherenceLog {
  id?: string;
  user_id: string;
  group: StudyGroup;
  goal: Goal | null;
  day: number; // 0..6, the template day this relates to
  item_title: string;
  outcome: Outcome;
  /** Actual minutes exercised (0 for skipped). */
  minutes: number;
  /** Soft target minutes from the template, for later comparison. */
  target_minutes: number;
  logged_at: string; // ISO
}
