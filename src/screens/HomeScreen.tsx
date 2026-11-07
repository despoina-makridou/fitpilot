import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { templateForGoal, todayIndex, dayName } from '../lib/templates';
import { makeNudge, makeDailyTip, CoachContext } from '../ai/brain';
import { initLLM } from '../ai/llm';
import { isModelBundled } from '../ai/model';
import { flatExercises, Equipment } from '../lib/exercises';
import { getLocalProfile, LocalProfile } from '../lib/localProfile';
import { isCollecting } from '../lib/trial';
import { recentLogs, fetchLoggedKeys } from '../lib/db';
import { backfillMissedSessions } from '../lib/backfill';
import { flushQueue } from '../lib/syncQueue';
import { pointsThisWindow, totalPoints, windowMaxPoints } from '../lib/points';
import { PointsInfoModal } from '../components/PointsInfo';
import { ThinkingText } from '../components/ThinkingText';
import { refreshRemindersInBackground } from '../lib/notifications';
import { AdherenceLog, TemplateItem } from '../types';
import { Card, Screen, Button } from '../components/ui';
import { theme } from '../theme';

export default function HomeScreen({ navigation, route }: any) {
  const { session, profile } = useAuth();
  const goal = profile?.goal ?? 'maintain';
  const template = templateForGoal(goal);
  const today = todayIndex();
  const todayItem: TemplateItem | undefined = template.items.find((i) => i.day === today);
  const isAI = profile?.group === 'ai';

  // Exercises the user can actually do — fed to the AI so it never suggests
  // something they can't do.
  const owned = (profile?.equipment ?? []) as Equipment[];

  const [local, setLocal] = useState<LocalProfile>({});
  const [nudge, setNudge] = useState<string | null>(null);
  const [dailyTip, setDailyTip] = useState<string | null>(null);
  const [logs, setLogs] = useState<AdherenceLog[]>([]);
  const [justLogged, setJustLogged] = useState<{ outcome: string; text: string } | null>(null);

  // The coach name comes from the LOCAL (device-only) profile, never the cloud.
  const coachCtx: CoachContext = {
    goal,
    name: local.name,
    availableExercises: flatExercises(goal, owned),
  };

  // Reload fresh data every time Home gains focus (no stale cache). Also picks
  // up the `justLogged` confirmation passed from the Exercise screen.
  useFocusEffect(
    useCallback(() => {
      let alive = true;

      // Show the confirmation passed from the Exercise screen, then clear it.
      if (route?.params?.justLogged) {
        setJustLogged(route.params.justLogged);
        navigation.setParams({ justLogged: undefined });
      }

      getLocalProfile().then((lp) => alive && setLocal(lp));

      // Offline-safe study sync: flush any queued records, then backfill any
      // past scheduled sessions the user never logged (as auto-misses), so the
      // cloud has a correct scheduled-vs-done denominator for adherence.
      // Only while the 15-day study is still collecting.
      if (session?.user && profile && isCollecting(profile)) {
        (async () => {
          try {
            await flushQueue();
            const loggedKeys = await fetchLoggedKeys(session.user.id);
            await backfillMissedSessions({
              userId: session.user.id,
              group: profile.group,
              goal,
              template,
              loggedKeys,
              startedISO: profile.created_at ?? new Date().toISOString(),
            });
          } catch {
            // offline / transient — will retry next open
          }
        })();
      }

      if (isAI && isModelBundled()) initLLM().catch(() => {});
      if (isAI) {
        // Regenerate the coach text on every app open. Clear first so the
        // fun "thinking…" loader shows, and enforce a minimum ~10s display so
        // the rotating messages get a good run before the real text appears.
        setNudge(null);
        setDailyTip(null);
        const started = Date.now();
        const minMs = 10000;
        const holdThenSet = (setter: (v: string) => void) => (t: string) => {
          const wait = Math.max(0, minMs - (Date.now() - started));
          setTimeout(() => alive && setter(t), wait);
        };
        if (todayItem) makeNudge(todayItem, coachCtx).then(holdThenSet(setNudge));
        const todaySeed = new Date().toISOString();
        makeDailyTip(coachCtx, todaySeed).then(holdThenSet(setDailyTip));
      }
      if (session?.user) {
        recentLogs(session.user.id, 30).then((l) => alive && setLogs(l)).catch(() => {});
      }
      if (profile && isCollecting(profile)) {
        // Fire-and-forget: builds notifications in the background (after the UI
        // is interactive, once per day, yielding between each) so there is NO
        // slow start while the on-device model writes the nudges.
        refreshRemindersInBackground(template, profile.group, coachCtx);
      }

      return () => {
        alive = false;
      };
    }, [isAI, todayItem?.title, session?.user?.id, profile?.group, route?.params?.justLogged]),
  );

  // "X / Y this week": completed sessions vs total scheduled in the template.
  const totalThisWeek = template.items.length;
  const completedThisWeek = logs.filter((l) => l.outcome === 'completed' && isThisWeek(l.logged_at)).length;
  const progress = totalThisWeek ? Math.min(1, completedThisWeek / totalThisWeek) : 0;

  // Points. `created_at` is when the user started (defines the 7-day windows).
  const startISO = profile?.created_at ?? new Date().toISOString();
  const windowPts = pointsThisWindow(logs, startISO);
  const allTimePts = totalPoints(logs, startISO);
  const windowMax = windowMaxPoints(template.items.length);
  const ptsProgress = windowMax ? Math.min(1, windowPts / windowMax) : 0;
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={s.hi}>Hey{local.name ? ` ${local.name}` : ''} 👋</Text>
        <Text style={s.plan}>{template.name} · {dayName(today)}</Text>

        {justLogged && (
          <View style={s.loggedBanner}>
            {isAI && <Text style={s.loggedTag}>AI COACH</Text>}
            <Text style={s.loggedText}>{justLogged.text}</Text>
          </View>
        )}

        {todayItem ? (
          <Card style={s.todayCard}>
            <Text style={s.todayKicker}>TODAY'S SESSION</Text>
            <Text style={s.todayTitle}>{todayItem.title}</Text>
            <Text style={s.todayTarget}>{todayItem.target}</Text>
            <Button
              title="Start session"
              onPress={() => navigation.navigate('Exercise')}
              style={{ marginTop: theme.space(4) }}
            />
          </Card>
        ) : (
          <Card style={s.todayCard}>
            <Text style={s.todayKicker}>TODAY</Text>
            <Text style={s.todayTitle}>Rest day</Text>
            <Text style={s.todayTarget}>Nothing scheduled. Move if you feel like it.</Text>
            <Button
              title="Log a workout anyway"
              variant="secondary"
              onPress={() => navigation.navigate('Exercise')}
              style={{ marginTop: theme.space(4) }}
            />
          </Card>
        )}

        {/* AI coach card — visually distinct, clean copy. */}
        {isAI && (
          <View style={s.coachCard}>
            <View style={s.coachHead}>
              <View style={s.coachAvatar}>
                <Text style={s.coachAvatarText}>AI</Text>
              </View>
              <Text style={s.coachName}>Your coach</Text>
            </View>
            {todayItem && (
              nudge ? <Text style={s.coachMsg}>{nudge}</Text>
                    : <ThinkingText style={s.coachMsg} />
            )}
            {dailyTip
              ? <Text style={s.coachTip}>💡 {dailyTip}</Text>
              : !todayItem
                ? <ThinkingText style={s.coachTip} />
                : null}
          </View>
        )}

        {/* Points card — AI arm gets a motivational framing. */}
        <View style={s.sectionRow}>
          <Text style={s.section}>{isAI ? '⭐ Your points' : 'Points'}</Text>
          <Text style={s.infoBtn} onPress={() => setInfoOpen(true)}>ⓘ How it works</Text>
        </View>
        <Card style={isAI ? s.pointsCardAI : undefined}>
          <View style={s.progressRow}>
            <Text style={s.progressNum}>
              {windowPts}<Text style={s.progressDen}> / {windowMax}</Text>
            </Text>
            <Text style={s.progressLabel}>
              {isAI ? 'points this\nweek — reach max!' : 'points this\nweek'}
            </Text>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${ptsProgress * 100}%` }]} />
          </View>
          <Text style={s.allTime}>{allTimePts} points all-time</Text>
        </Card>

        <Text style={s.section}>This week</Text>
        <Card>
          <View style={s.progressRow}>
            <Text style={s.progressNum}>
              {completedThisWeek}<Text style={s.progressDen}> / {totalThisWeek}</Text>
            </Text>
            <Text style={s.progressLabel}>sessions{'\n'}completed</Text>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </Card>

        <Text style={s.section}>Your week</Text>
        {template.items.map((item, idx) => (
          <View key={idx} style={s.weekRow}>
            <View style={[s.dayPill, item.day === today && s.dayPillToday]}>
              <Text style={[s.dayPillText, item.day === today && { color: theme.colors.onAccent }]}>
                {dayName(item.day)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.weekTitle}>{item.title}</Text>
              <Text style={s.weekTarget}>{item.target}</Text>
            </View>
          </View>
        ))}
        <View style={{ height: theme.space(8) }} />
      </ScrollView>
      <PointsInfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} />
    </Screen>
  );
}

/** True if an ISO timestamp falls in the current Mon–Sun week. */
function isThisWeek(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  const monday = new Date(now);
  const dow = (now.getDay() + 6) % 7; // 0=Mon
  monday.setDate(now.getDate() - dow);
  monday.setHours(0, 0, 0, 0);
  return d >= monday;
}

const s = StyleSheet.create({
  hi: { color: theme.colors.text, fontSize: theme.font.h1, fontWeight: '800', marginTop: theme.space(4) },
  plan: { color: theme.colors.textDim, fontSize: theme.font.body, marginTop: 2 },
  loggedBanner: {
    marginTop: theme.space(4),
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.success,
    padding: theme.space(4),
  },
  loggedTag: { color: theme.colors.accent, fontSize: theme.font.tiny, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  loggedText: { color: theme.colors.text, fontSize: theme.font.body, lineHeight: 21 },
  todayCard: { marginTop: theme.space(5) },
  todayKicker: { color: theme.colors.accent, fontSize: theme.font.tiny, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  todayTitle: { color: theme.colors.text, fontSize: theme.font.h2, fontWeight: '800' },
  todayTarget: { color: theme.colors.textDim, fontSize: theme.font.body, marginTop: 4 },
  section: { color: theme.colors.text, fontSize: theme.font.h3, fontWeight: '700', marginTop: theme.space(7), marginBottom: theme.space(3) },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.space(7), marginBottom: theme.space(3) },
  infoBtn: { color: theme.colors.accent, fontSize: theme.font.small, fontWeight: '600' },
  pointsCardAI: { borderColor: theme.colors.accent },
  allTime: { color: theme.colors.textDim, fontSize: theme.font.small, marginTop: theme.space(3) },

  // AI coach card
  coachCard: {
    marginTop: theme.space(4),
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.lg,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.accent,
    padding: theme.space(4),
  },
  coachHead: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.space(2) },
  coachAvatar: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: theme.colors.accent,
    alignItems: 'center', justifyContent: 'center', marginRight: theme.space(2),
  },
  coachAvatarText: { color: theme.colors.onAccent, fontWeight: '900', fontSize: theme.font.tiny },
  coachName: { color: theme.colors.text, fontWeight: '700', fontSize: theme.font.small },
  coachMsg: { color: theme.colors.text, fontSize: theme.font.body, lineHeight: 22 },
  coachTip: { color: theme.colors.textDim, fontSize: theme.font.small, lineHeight: 20, marginTop: theme.space(2), fontStyle: 'italic' },

  // This-week progress
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.space(3) },
  progressNum: { color: theme.colors.accent, fontSize: 40, fontWeight: '800' },
  progressDen: { color: theme.colors.textFaint, fontSize: 24, fontWeight: '700' },
  progressLabel: { color: theme.colors.textDim, fontSize: theme.font.small, marginLeft: theme.space(3), lineHeight: 16 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: theme.colors.surfaceAlt, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: theme.colors.accent },
  weekRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.space(2) },
  dayPill: { width: 46, height: 32, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginRight: theme.space(3) },
  dayPillToday: { backgroundColor: theme.colors.accent },
  dayPillText: { color: theme.colors.textDim, fontSize: theme.font.small, fontWeight: '700' },
  weekTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '600' },
  weekTarget: { color: theme.colors.textFaint, fontSize: theme.font.small },
});
