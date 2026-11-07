import { Profile, TRIAL_DAYS } from '../types';

/**
 * Each user's study runs for TRIAL_DAYS days from signup (profile.created_at).
 * After that the app stops collecting data and shows the questionnaire.
 */

/** Whole days elapsed since the user signed up. Day 0 = signup day. */
export function daysSinceStart(profile: Profile | null): number {
  if (!profile?.created_at) return 0;
  const start = new Date(profile.created_at).getTime();
  return Math.floor((Date.now() - start) / 86400000);
}

/** True once the 15-day study period has elapsed. */
export function isTrialOver(profile: Profile | null): boolean {
  return daysSinceStart(profile) >= TRIAL_DAYS;
}

/** Days left in the study (0 once over). */
export function daysRemaining(profile: Profile | null): number {
  return Math.max(0, TRIAL_DAYS - daysSinceStart(profile));
}

/** The study is fully finished for this user (trial over AND questionnaire done). */
export function isStudyComplete(profile: Profile | null): boolean {
  return isTrialOver(profile) && !!profile?.questionnaire_done_at;
}

/**
 * True while the app should STILL collect data (log workouts, send to DB,
 * schedule reminders). Stops once the trial is over.
 */
export function isCollecting(profile: Profile | null): boolean {
  return !isTrialOver(profile);
}
