import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { WorkoutTemplate, StudyGroup } from '../types';
import { makeNudge, plainReminder, CoachContext } from '../ai/brain';

/**
 * Local notifications for pre-session reminders.
 *
 * AI arm  -> nudge text generated on-device by the model (makeNudge).
 * Non-AI  -> plain reminder text (plainReminder).
 *
 * We schedule a weekly repeating reminder per template item, a few hours
 * before a nominal session time. Times are deliberately soft (the study
 * schedule isn't clock-strict), so we fire a single daily-ish reminder rather
 * than a precise minute.
 */

// Nominal reminder hour (local). A few hours "before" an evening session.
const REMINDER_HOUR = 16; // 4pm

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

/**
 * (Re)schedule this week's reminders for the user. Clears existing ones first.
 * Weekday trigger uses 1=Sunday..7=Saturday (Expo/OS convention); our template
 * day is 0=Mon..6=Sun, so we convert.
 */
export async function scheduleWeeklyReminders(
  template: WorkoutTemplate,
  group: StudyGroup,
  coachCtx: CoachContext,
): Promise<void> {
  const ok = await ensureNotificationPermission();
  if (!ok) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const item of template.items) {
    // Generate the body up front. For the AI arm this runs the on-device model
    // now (once per scheduling), which is fine and keeps notifications offline.
    const body =
      group === 'ai' ? await makeNudge(item, coachCtx) : plainReminder(item);

    const expoWeekday = ((item.day + 1) % 7) + 1; // 0(Mon)->2 ... 6(Sun)->1

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${item.title} today`,
        body,
        ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: expoWeekday,
        hour: REMINDER_HOUR,
        minute: 0,
      },
    });
  }
}
