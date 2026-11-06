import { AdherenceLog } from '../types';

/**
 * Points system — measures how consistently a user shows up, rewarding streaks
 * within each rolling 7-day window (counted from when the user started, NOT
 * calendar weeks).
 *
 * Per session:
 *   base   = min(minutes / target, 1) * 10        // 0..10, % of target done
 *   streak = position of this session among the EFFORT sessions (minutes > 0)
 *            in its 7-day window, starting at +0 for the first: +0,+1,+2,...
 *   points = round(base) + streak
 *
 * Skips / auto-misses (minutes == 0) earn 0 points and do NOT advance the
 * streak — the bonus rewards actually training. Doing more sessions in a window
 * compounds, so a 6-day-a-week user can out-earn a 1-day user by showing up,
 * without their bigger schedule alone handing them points.
 */

export interface SessionPoints {
  log: AdherenceLog;
  base: number;   // 0..10 (rounded)
  streak: number; // +0, +1, +2...
  points: number; // base + streak
}

function basePoints(minutes: number, target: number): number {
  if (!target || minutes <= 0) return 0;
  return Math.round(Math.min(minutes / target, 1) * 10);
}

/**
 * Rolling 7-day window index since the user started (day 0..6 -> window 0,
 * 7..13 -> window 1, ...). `startISO` is the user's created_at / first day.
 */
function windowIndex(startISO: string, whenISO: string): number {
  const start = new Date(startISO);
  const when = new Date(whenISO);
  const days = Math.floor((when.getTime() - start.getTime()) / 86400000);
  return Math.max(0, Math.floor(days / 7));
}

/**
 * Compute per-session points for a user's logs. `startISO` = when they started
 * (profile.created_at). Logs may be in any order; we sort ascending by time.
 */
export function computePoints(logs: AdherenceLog[], startISO: string): SessionPoints[] {
  const sorted = [...logs].sort(
    (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime(),
  );

  // Track how many EFFORT sessions we've seen per window so far.
  const effortCountByWindow = new Map<number, number>();
  const out: SessionPoints[] = [];

  for (const log of sorted) {
    const base = basePoints(log.minutes, log.target_minutes);
    const hasEffort = log.minutes > 0;

    let streak = 0;
    if (hasEffort) {
      const w = windowIndex(startISO, log.logged_at);
      const seen = effortCountByWindow.get(w) ?? 0; // sessions before this one
      streak = seen; // 1st effort session -> +0, 2nd -> +1, ...
      effortCountByWindow.set(w, seen + 1);
    }

    out.push({ log, base, streak, points: base + streak });
  }

  return out;
}

/** Total points across all logs. */
export function totalPoints(logs: AdherenceLog[], startISO: string): number {
  return computePoints(logs, startISO).reduce((s, p) => s + p.points, 0);
}

/**
 * Compute points for a NEW session being logged now, given the user's prior
 * logs (to know the streak position in the current window). Returns the pieces
 * to store on the row. Used at log time so the DB gets the correct points.
 */
export function pointsForNewSession(params: {
  minutes: number;
  target: number;
  whenISO: string;
  startISO: string;
  priorLogs: AdherenceLog[];
}): { base_points: number; streak_bonus: number; points: number } {
  const base = basePoints(params.minutes, params.target);
  let streak = 0;
  if (params.minutes > 0) {
    const w = windowIndex(params.startISO, params.whenISO);
    // Count prior EFFORT sessions in the same window.
    const priorEffort = params.priorLogs.filter(
      (l) => l.minutes > 0 && windowIndex(params.startISO, l.logged_at) === w,
    ).length;
    streak = priorEffort; // 1st effort session this window -> +0
  }
  return { base_points: base, streak_bonus: streak, points: base + streak };
}

/** Points earned in the current 7-day window (from start). */
export function pointsThisWindow(logs: AdherenceLog[], startISO: string): number {
  const now = new Date().toISOString();
  const curWindow = windowIndex(startISO, now);
  return computePoints(logs, startISO)
    .filter((p) => windowIndex(startISO, p.log.logged_at) === curWindow)
    .reduce((s, p) => s + p.points, 0);
}

/**
 * A soft "max" for the current window, for a progress bar / "reach your max"
 * framing: if the user did every remaining scheduled session at full effort.
 * We approximate with a target of `perWeekTarget` sessions at ~10 base + rising
 * streak. Purely for motivation UI.
 */
export function windowMaxPoints(perWeekTarget: number): number {
  // full base (10) each, plus streak 0+1+2+...+(n-1)
  const n = Math.max(1, perWeekTarget);
  const streakSum = (n * (n - 1)) / 2;
  return n * 10 + streakSum;
}
