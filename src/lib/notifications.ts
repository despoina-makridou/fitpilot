import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutTemplate, StudyGroup } from '../types';
import { makeNudge, CoachContext } from '../ai/brain';

/** Yield to the UI thread so heavy loops never jank the app. */
const yieldToUI = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Local notifications with an escalating daily "ladder".
 *
 * These are scheduled as WEEKLY-repeating OS alarms, so they fire even if the
 * app is fully closed / force-quit / after reboot — the operating system holds
 * them, not the app. Logging a workout (which requires opening the app) cancels
 * that day's remaining rungs; the weekly schedule auto-returns next time.
 *
 * AI arm  -> each rung's text is generated on-device by the model, with a tone
 *            matching the rung (friendly -> urgent -> angry -> goodnight).
 * Non-AI  -> fixed plain text per rung.
 */

type Tone = 'friendly' | 'urgent' | 'angry' | 'goodnight' | 'inspire';

interface Rung {
  hour: number;
  tone: Tone;
}

// Ladder for a day that HAS a scheduled workout (escalates if not yet done).
const WORKOUT_LADDER: Rung[] = [
  { hour: 12, tone: 'friendly' },
  { hour: 13, tone: 'friendly' },
  { hour: 14, tone: 'friendly' },
  { hour: 18, tone: 'urgent' },
  { hour: 19, tone: 'urgent' },
  { hour: 20, tone: 'angry' },
  { hour: 21, tone: 'goodnight' },
];

// Lighter ladder for a REST day: just gentle inspiration to move.
const REST_LADDER: Rung[] = [
  { hour: 13, tone: 'inspire' },
  { hour: 18, tone: 'inspire' },
];

export function registerNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const settings = await Notifications.getPermissionsAsync();
  let granted = settings.granted;
  if (!granted) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.granted;
  }
  if (granted && Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Workout reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return granted;
}

/** Title + fixed (non-AI) body per tone. */
function rungText(tone: Tone, title: string): { title: string; body: string } {
  switch (tone) {
    case 'friendly':
      return { title: `${title} today`, body: `Time for your ${title.toLowerCase()} session — you've got this.` };
    case 'urgent':
      return { title: `Still time for ${title}`, body: `The day's not over — squeeze in your ${title.toLowerCase()} session.` };
    case 'angry':
      return { title: `😤 Don't skip today!`, body: `You haven't done your ${title.toLowerCase()} yet. No excuses — get moving!` };
    case 'goodnight':
      return { title: `😴 Last call`, body: `Day's almost done. A few minutes now still counts. Tomorrow, let's do better.` };
    case 'inspire':
      return { title: `Move a little 🌿`, body: `No session scheduled, but a short walk or stretch keeps the streak alive.` };
  }
}

/** AI-arm prompt tone hint appended to the nudge request. */
function tonePrompt(tone: Tone): string {
  switch (tone) {
    case 'friendly': return 'Tone: warm and encouraging.';
    case 'urgent': return "Tone: a bit more urgent — they haven't trained yet and time is running out today.";
    case 'angry': return 'Tone: playfully stern/frustrated (a coach who wants them to stop making excuses). Keep it motivating, not mean.';
    case 'goodnight': return "Tone: gentle last-call, wind-down for the night, hopeful about tomorrow.";
    case 'inspire': return 'Tone: light inspiration to move a little even though nothing is scheduled.';
  }
}

const LAST_SCHED_KEY = 'fitpilot.lastReminderSchedule';

/**
 * Kick off (re)scheduling in the BACKGROUND without blocking the UI.
 *
 * Returns immediately. The actual work waits until the app is interactive
 * (InteractionManager), skips if already done today (so opening the app
 * repeatedly doesn't re-generate), and yields to the UI thread between each
 * notification so the on-device model generation never makes the app janky.
 * The user is fully using the app while this happens.
 */
export function refreshRemindersInBackground(
  template: WorkoutTemplate,
  group: StudyGroup,
  coachCtx: CoachContext,
): void {
  InteractionManager.runAfterInteractions(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const last = await AsyncStorage.getItem(LAST_SCHED_KEY);
      if (last === today) return; // already scheduled today — nothing to do

      await scheduleWeeklyReminders(template, group, coachCtx);
      await AsyncStorage.setItem(LAST_SCHED_KEY, today);
    } catch {
      // best-effort; will retry next open
    }
  });
}

/**
 * (Re)schedule the full weekly notification ladder. Scheduled as WEEKLY OS
 * alarms so they fire even if the app is closed. Yields to the UI thread
 * between each notification so it can run in the background without jank.
 * Prefer refreshRemindersInBackground() from screens.
 */
export async function scheduleWeeklyReminders(
  template: WorkoutTemplate,
  group: StudyGroup,
  coachCtx: CoachContext,
): Promise<void> {
  const ok = await ensureNotificationPermission();
  if (!ok) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  // For the AI arm, pre-generate ONE line per TONE (5 total) and reuse them
  // across all rungs. The full weekly ladder is 30+ notifications; generating
  // a fresh model line for each would run the on-device model 30+ times and
  // freeze the app. 5 generations is fine, and the tone is what varies anyway.
  const tones: Tone[] = ['friendly', 'urgent', 'angry', 'goodnight', 'inspire'];
  const aiByTone: Partial<Record<Tone, string>> = {};
  if (group === 'ai') {
    for (const tone of tones) {
      try {
        const anyItem = template.items[0];
        aiByTone[tone] = await makeNudge(
          anyItem ?? { day: 0, title: 'Movement', target: 'a short session', targetMinutes: 15 },
          { ...coachCtx, toneHint: tonePrompt(tone) },
        );
      } catch {
        // leave undefined -> falls back to templated text for that tone
      }
      await yieldToUI(); // breathe between each of the 5 generations
    }
  }

  for (let day = 0; day < 7; day++) {
    const item = template.items.find((it) => it.day === day);
    const ladder = item ? WORKOUT_LADDER : REST_LADDER;
    const expoWeekday = ((day + 1) % 7) + 1; // 0(Mon)->2 ... 6(Sun)->1

    for (const rung of ladder) {
      const fixed = rungText(rung.tone, item ? item.title : 'Workout');
      const body = group === 'ai' ? aiByTone[rung.tone] || fixed.body : fixed.body;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: fixed.title,
          body,
          data: { day }, // tag with weekday so we can cancel just today's
          ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: expoWeekday,
          hour: rung.hour,
          minute: 0,
        },
      });
    }
  }
}

/**
 * Cancel today's remaining scheduled reminders — called when the user logs a
 * workout, so they stop being nagged for the rest of the day. The weekly
 * schedule automatically brings the ladder back on the next day.
 */
export async function cancelTodaysReminders(): Promise<void> {
  const todayIdx = (new Date().getDay() + 6) % 7; // 0=Mon..6=Sun
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    const day = (n.content?.data as any)?.day;
    if (day === todayIdx) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}
