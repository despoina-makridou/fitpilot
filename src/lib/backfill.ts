import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutTemplate, StudyGroup, Goal } from '../types';
import { enqueueLog, flushQueue } from './syncQueue';

/**
 * Backfill missed scheduled sessions.
 *
 * A closed app can't reliably run at end-of-day, so instead: every time the app
 * opens, we look back over the last N days at each SCHEDULED session day and, if
 * that day has no record yet, we queue an 'auto_miss' (skipped). Combined with
 * the offline sync queue, this guarantees every scheduled session eventually
 * gets a data point — done or missed — so adherence has a correct denominator.
 *
 * We track how far we've already backfilled (last processed date) locally so we
 * don't re-scan the same days.
 */

const LAST_BACKFILL_KEY = 'fitpilot.lastBackfillDate';
const LOOKBACK_DAYS = 14; // safety window if the app wasn't opened for a while

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}
/** template day index: 0=Mon..6=Sun from a JS Date. */
function templateDayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/**
 * @param loggedSessionDates set of 'YYYY-MM-DD|item_title' the user already has
 *        a log for (fetched from the cloud), so we don't overwrite real logs.
 */
export async function backfillMissedSessions(params: {
  userId: string;
  group: StudyGroup;
  goal: Goal | null;
  template: WorkoutTemplate;
  loggedKeys: Set<string>; // 'YYYY-MM-DD|item_title'
  /** When the user's account started — NEVER backfill before this. */
  startedISO: string;
}): Promise<void> {
  const { userId, group, goal, template, loggedKeys, startedISO } = params;

  const today = new Date();
  const todayStr = toDateStr(today);

  // The scan can go back at most LOOKBACK_DAYS, but NEVER before the user
  // actually signed up (a brand-new user has no past sessions to miss).
  const lookback = new Date(today);
  lookback.setDate(lookback.getDate() - LOOKBACK_DAYS);
  const signup = new Date(startedISO);
  signup.setHours(0, 0, 0, 0);
  // The user only starts being "scheduled" the day AFTER they signed up.
  const signupNext = new Date(signup);
  signupNext.setDate(signupNext.getDate() + 1);
  const earliest = signupNext > lookback ? signupNext : lookback;

  let start = earliest;
  const lastStr = await AsyncStorage.getItem(LAST_BACKFILL_KEY);
  if (lastStr) {
    const last = new Date(lastStr);
    const dayAfter = new Date(last);
    dayAfter.setDate(dayAfter.getDate() + 1);
    if (dayAfter > earliest) start = dayAfter;
  }

  // Walk each day from start up to (but not including) today. We don't backfill
  // today itself — the user may still do it.
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  while (toDateStr(cursor) < todayStr) {
    const dayIdx = templateDayIndex(cursor);
    const scheduled = template.items.filter((it) => it.day === dayIdx);
    const dateStr = toDateStr(cursor);

    for (const item of scheduled) {
      const key = `${dateStr}|${item.title}`;
      if (!loggedKeys.has(key)) {
        // No record for this scheduled session → queue an auto miss.
        await enqueueLog({
          user_id: userId,
          session_date: dateStr,
          item_title: item.title,
          group,
          goal,
          day: dayIdx,
          outcome: 'skipped',
          minutes: 0,
          target_minutes: item.targetMinutes,
          source: 'auto_miss',
          logged_at: new Date().toISOString(),
          // A miss earns no points and doesn't affect the streak.
          points: 0,
          base_points: 0,
          streak_bonus: 0,
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  await AsyncStorage.setItem(LAST_BACKFILL_KEY, todayStr);
  await flushQueue();
}
