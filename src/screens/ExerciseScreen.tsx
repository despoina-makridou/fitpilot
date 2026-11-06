import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { enqueueLog } from '../lib/syncQueue';
import { recentLogs } from '../lib/db';
import { pointsForNewSession } from '../lib/points';
import { makeEncouragement, CoachContext } from '../ai/brain';
import { templateForGoal, todayIndex, dayName } from '../lib/templates';
import {
  availableExercises,
  flatExercises,
  suggestedMinutes,
  Equipment,
  equipmentLabel,
} from '../lib/exercises';
import { playTimerDone } from '../lib/sound';
import { getLocalProfile } from '../lib/localProfile';
import { AdherenceLog, Outcome, TemplateItem } from '../types';
import { Button, Card, Screen } from '../components/ui';
import { theme } from '../theme';

/**
 * Exercise mode — THE measurement screen. The user picks today's session,
 * runs a timer while they exercise, then logs the outcome:
 *   completed  -> did it (minutes recorded)
 *   partial    -> started but couldn't finish (minutes recorded)
 *   skipped    -> didn't do it (0 minutes)
 * Each log is the adherence signal written to Supabase.
 *
 * For the AI arm, after logging we show a short on-device-generated
 * encouragement line. The non-AI arm just gets a neutral confirmation.
 */
export default function ExerciseScreen({ navigation }: any) {
  const { session, profile } = useAuth();
  const goal = profile?.goal ?? 'maintain';
  const template = templateForGoal(goal);
  const today = todayIndex();

  // Today's item, or the first item as a fallback (rest days still let you log).
  const item: TemplateItem =
    template.items.find((i) => i.day === today) ?? template.items[0];

  // Exercises available to this user: their goal x the equipment they ticked.
  const owned = (profile?.equipment ?? []) as Equipment[];
  const exerciseGroups = useMemo(
    () => availableExercises(goal, owned),
    [goal, profile?.equipment],
  );

  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [result, setResult] = useState<{ outcome: Outcome; text: string } | null>(null);
  const [reached, setReached] = useState(false);
  const [localName, setLocalName] = useState<string | undefined>();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    getLocalProfile().then((lp) => setLocalName(lp.name));
  }, []);

  // Timer target: the picked exercise's suggested time, else the session target.
  const targetMinutes = selectedExercise ? suggestedMinutes(selectedExercise) : item.targetMinutes;
  const targetSecs = targetMinutes * 60;

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  // Fire sound + vibration once when the target time is reached.
  useEffect(() => {
    if (running && seconds >= targetSecs && !firedRef.current) {
      firedRef.current = true;
      setReached(true);
      playTimerDone();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [seconds, targetSecs, running]);

  function start() {
    setResult(null);
    setSeconds(0);
    setReached(false);
    firedRef.current = false;
    setRunning(true);
    timer.current = setInterval(() => setSeconds((x) => x + 1), 1000);
  }

  function stopTimer() {
    setRunning(false);
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }

  const minutes = Math.round(seconds / 60);
  const isAI = profile?.group === 'ai';
  const coachCtx: CoachContext = {
    goal,
    name: localName, // device-only name, never the cloud
    availableExercises: flatExercises(goal, owned),
  };

  async function log(outcome: Outcome) {
    if (!session?.user || !profile) return;
    stopTimer();
    setSaving(true);
    const mins = outcome === 'skipped' ? 0 : minutes;
    // Log against the specific exercise the user chose (falls back to the
    // session title if none was picked, e.g. a quick skip).
    // Log against the chosen exercise AND the target the user was actually
    // timing against (per-exercise when one is selected), so "minutes vs
    // target_minutes" is meaningful in the study data.
    const loggedItem: TemplateItem = {
      ...item,
      title: selectedExercise ?? item.title,
      targetMinutes,
    };
    try {
      // Compute this session's points now (streak depends on prior sessions in
      // the current 7-day window). Fetch recent logs to know the position.
      const nowISO = new Date().toISOString();
      const startISO = profile.created_at ?? nowISO;
      let priorLogs: AdherenceLog[] = [];
      try {
        priorLogs = await recentLogs(session.user.id, 100);
      } catch {
        // offline — streak will be based on no priors (worst case +0)
      }
      const pts = pointsForNewSession({
        minutes: mins,
        target: loggedItem.targetMinutes,
        whenISO: nowISO,
        startISO,
        priorLogs,
      });

      // Route through the offline-safe queue: it saves locally, sends to the
      // DB, and confirms delivery (retrying later if offline). Idempotent via
      // the (user, session_date, item_title) unique key.
      const todayStr = nowISO.slice(0, 10);
      await enqueueLog({
        user_id: session.user.id,
        session_date: todayStr,
        item_title: loggedItem.title,
        group: profile.group,
        goal: profile.goal,
        day: loggedItem.day,
        outcome,
        minutes: mins,
        target_minutes: loggedItem.targetMinutes,
        source: 'manual',
        logged_at: nowISO,
        points: pts.points,
        base_points: pts.base_points,
        streak_bonus: pts.streak_bonus,
      });

      let text: string;
      if (isAI) {
        text = await makeEncouragement(loggedItem, outcome, mins, coachCtx); // on-device model
      } else {
        text =
          outcome === 'completed'
            ? 'Logged. Nice — see you next session.'
            : outcome === 'partial'
            ? 'Logged. Partial session recorded.'
            : 'Logged. Session marked as skipped.';
      }
      // Reset this screen and go back to Home; pass the result so Home can show
      // a short confirmation / coach message.
      setResult(null);
      setSeconds(0);
      setSelectedExercise(null);
      setReached(false);
      firedRef.current = false;
      navigation.navigate('Home', { justLogged: { outcome, text } });
    } catch (e: any) {
      setResult({ outcome, text: `Could not save: ${e?.message ?? 'error'}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={s.kicker}>{dayName(today)} · today's session</Text>
      <Text style={s.title}>{selectedExercise ?? item.title}</Text>
      <Text style={s.target}>{item.target}</Text>

      {/* Pick a specific exercise from the user's goal x equipment set. */}
      {exerciseGroups.length > 0 && (
        <View style={s.pickerWrap}>
          <Text style={s.pickerHeading}>Choose your exercise</Text>
          {exerciseGroups.map((group) => (
            <View key={group.equipment} style={{ marginBottom: theme.space(3) }}>
              <Text style={s.groupLabel}>{equipmentLabel(group.equipment)}</Text>
              <View style={s.chips}>
                {group.exercises.map((ex) => {
                  const active = selectedExercise === ex;
                  return (
                    <Pressable
                      key={ex}
                      onPress={() => setSelectedExercise(active ? null : ex)}
                      style={[s.chip, active && s.chipActive]}
                    >
                      <Text style={[s.chipText, active && { color: theme.colors.onAccent }]}>{ex}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}

      <Card style={s.timerCard}>
        <Text style={[s.clock, reached && { color: theme.colors.accent }]}>{fmt(seconds)}</Text>
        <Text style={s.clockSub}>
          {reached
            ? `🎯 ${targetMinutes} min reached — great job!`
            : `target ${targetMinutes} min${selectedExercise ? ` · ${selectedExercise}` : ''}`}
        </Text>

        {!running ? (
          <Button
            title={seconds === 0 ? 'Start' : 'Resume'}
            onPress={start}
            style={{ marginTop: theme.space(5), alignSelf: 'stretch' }}
          />
        ) : (
          <Button
            title="Pause"
            variant="secondary"
            onPress={stopTimer}
            style={{ marginTop: theme.space(5), alignSelf: 'stretch' }}
          />
        )}
      </Card>

      <Text style={s.logHeading}>How did it go?</Text>
      <View style={s.actions}>
        <Button
          title="✅ Completed"
          onPress={() => log('completed')}
          loading={saving}
          style={{ flex: 1 }}
        />
      </View>
      <View style={s.actionsRow}>
        <Button
          title="⚠️ Couldn't finish"
          variant="secondary"
          onPress={() => log('partial')}
          disabled={saving}
          style={{ flex: 1, marginRight: theme.space(2) }}
        />
        <Button
          title="❌ Skipped"
          variant="danger"
          onPress={() => log('skipped')}
          disabled={saving}
          style={{ flex: 1, marginLeft: theme.space(2) }}
        />
      </View>

      {result && (
        <Card style={s.resultCard}>
          {isAI && <Text style={s.aiTag}>AI COACH</Text>}
          <Text style={s.resultText}>{result.text}</Text>
        </Card>
      )}
      <View style={{ height: theme.space(8) }} />
      </ScrollView>
    </Screen>
  );
}

function fmt(total: number): string {
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const s = StyleSheet.create({
  kicker: { color: theme.colors.accent, fontSize: theme.font.small, fontWeight: '700', marginTop: theme.space(4), textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: theme.colors.text, fontSize: theme.font.h1, fontWeight: '800', marginTop: 4 },
  target: { color: theme.colors.textDim, fontSize: theme.font.body, marginTop: 4 },
  timerCard: { alignItems: 'center', marginTop: theme.space(6) },
  clock: { color: theme.colors.text, fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'] },
  clockSub: { color: theme.colors.textDim, fontSize: theme.font.small, marginTop: 4 },
  logHeading: { color: theme.colors.text, fontSize: theme.font.h3, fontWeight: '700', marginTop: theme.space(7), marginBottom: theme.space(3) },
  actions: { flexDirection: 'row' },
  actionsRow: { flexDirection: 'row', marginTop: theme.space(3) },
  resultCard: { marginTop: theme.space(5) },
  aiTag: { color: theme.colors.accent, fontSize: theme.font.tiny, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  resultText: { color: theme.colors.text, fontSize: theme.font.body, lineHeight: 22 },
  pickerWrap: { marginTop: theme.space(5) },
  pickerHeading: { color: theme.colors.text, fontSize: theme.font.h3, fontWeight: '700', marginBottom: theme.space(3) },
  groupLabel: { color: theme.colors.textDim, fontSize: theme.font.small, fontWeight: '600', marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: theme.space(3),
    height: 38,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.space(2),
    marginBottom: theme.space(2),
  },
  chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipText: { color: theme.colors.text, fontWeight: '600', fontSize: theme.font.small },
});
