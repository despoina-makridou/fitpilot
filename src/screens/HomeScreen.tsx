import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { templateForGoal, todayIndex, dayName } from '../lib/templates';
import { makeNudge, CoachContext } from '../ai/brain';
import { initLLM } from '../ai/llm';
import { isModelBundled } from '../ai/model';
import { flatExercises, Equipment } from '../lib/exercises';
import { recentLogs } from '../lib/db';
import { scheduleWeeklyReminders } from '../lib/notifications';
import { AdherenceLog, TemplateItem } from '../types';
import { Card, Screen, Button } from '../components/ui';
import { theme } from '../theme';

export default function HomeScreen({ navigation }: any) {
  const { session, profile } = useAuth();
  const goal = profile?.goal ?? 'maintain';
  const template = templateForGoal(goal);
  const today = todayIndex();
  const todayItem: TemplateItem | undefined = template.items.find((i) => i.day === today);
  const isAI = profile?.group === 'ai';

  // Exercises the user can actually do — fed to the AI so it never suggests
  // something they can't do.
  const owned = (profile?.equipment ?? []) as Equipment[];
  const coachCtx: CoachContext = {
    goal,
    name: profile?.name,
    availableExercises: flatExercises(goal, owned),
  };

  const [nudge, setNudge] = useState<string | null>(null);
  const [logs, setLogs] = useState<AdherenceLog[]>([]);

  useEffect(() => {
    let alive = true;
    // AI arm: warm up the on-device model in the background so nudges and
    // post-workout encouragement are ready without a visible stall.
    if (isAI && isModelBundled()) {
      initLLM().catch(() => {});
    }
    // AI arm: generate a nudge for today's session on-device.
    if (isAI && todayItem) {
      makeNudge(todayItem, coachCtx).then((t) => alive && setNudge(t));
    }
    if (session?.user) {
      recentLogs(session.user.id, 30).then((l) => alive && setLogs(l)).catch(() => {});
    }
    // Schedule this week's reminders (idempotent — clears + re-adds).
    if (profile) {
      scheduleWeeklyReminders(template, profile.group, coachCtx).catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [isAI, todayItem?.title, session?.user?.id, profile?.group]);

  // "X / Y this week": completed sessions vs total scheduled in the template.
  const totalThisWeek = template.items.length;
  const completedThisWeek = logs.filter((l) => l.outcome === 'completed' && isThisWeek(l.logged_at)).length;
  const progress = totalThisWeek ? Math.min(1, completedThisWeek / totalThisWeek) : 0;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={s.hi}>Hey{profile?.name ? ` ${profile.name}` : ''} 👋</Text>
        <Text style={s.plan}>{template.name} · {dayName(today)}</Text>

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
        {isAI && todayItem && (
          <View style={s.coachCard}>
            <View style={s.coachHead}>
              <View style={s.coachAvatar}>
                <Text style={s.coachAvatarText}>AI</Text>
              </View>
              <Text style={s.coachName}>Your coach</Text>
            </View>
            <Text style={s.coachMsg}>{nudge ?? 'Preparing your message…'}</Text>
          </View>
        )}

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
  todayCard: { marginTop: theme.space(5) },
  todayKicker: { color: theme.colors.accent, fontSize: theme.font.tiny, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  todayTitle: { color: theme.colors.text, fontSize: theme.font.h2, fontWeight: '800' },
  todayTarget: { color: theme.colors.textDim, fontSize: theme.font.body, marginTop: 4 },
  section: { color: theme.colors.text, fontSize: theme.font.h3, fontWeight: '700', marginTop: theme.space(7), marginBottom: theme.space(3) },

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
