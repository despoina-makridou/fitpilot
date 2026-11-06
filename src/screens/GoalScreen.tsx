import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { saveGoalAndFinishOnboarding } from '../lib/db';
import { checkTargetWeight, weeklyPaceHint } from '../lib/guardrails';
import { getLocalProfile, LocalProfile } from '../lib/localProfile';
import { GOALS, Goal, GoalDetails } from '../types';
import { Button, Screen } from '../components/ui';
import { theme } from '../theme';

/**
 * Onboarding goal step. Two phases:
 *   1) pick a goal
 *   2) answer that goal's follow-up (target weight / muscle focus / frequency),
 *      with realistic guardrails (e.g. safe target weights based on the info
 *      collected on the previous screen).
 * The goal + details finish onboarding and feed the AI coach.
 */
export default function GoalScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [phase, setPhase] = useState<'pick' | 'details'>('pick');

  // follow-up answers
  const [targetWeight, setTargetWeight] = useState('');
  const [muscleFocus, setMuscleFocus] = useState<GoalDetails['muscle_focus']>();
  const [activity, setActivity] = useState<GoalDetails['endurance_activity']>('mixed');

  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Weight/height for the target-weight guardrail come from the LOCAL
  // (device-only) profile — they are never stored in the cloud.
  const [local, setLocal] = useState<LocalProfile>({});
  useEffect(() => {
    getLocalProfile().then(setLocal);
  }, []);

  const goalDef = GOALS.find((g) => g.id === goal);
  const currentKg = local.weight_kg ?? 0;
  const heightCm = local.height_cm ?? 0;

  function pick(g: Goal) {
    setGoal(g);
    setError(null);
    setWarn(null);
    setPhase('details');
  }

  async function finish() {
    if (!session?.user || !goal || !goalDef) return;
    setError(null);
    setWarn(null);

    const details: GoalDetails = {};

    if (goalDef.followup === 'target_weight') {
      const t = parseFloat(targetWeight);
      const verdict = checkTargetWeight(goal, currentKg, t, heightCm);
      if (!verdict.ok) {
        setError(verdict.message ?? 'Please check your target weight.');
        return;
      }
      if (verdict.level === 'warn' && !warn) {
        // Show the warning once; a second tap proceeds.
        setWarn(verdict.message ?? null);
        return;
      }
      details.target_weight_kg = t;
    } else if (goalDef.followup === 'muscle_focus') {
      if (!muscleFocus) {
        setError('Pick an area to focus on.');
        return;
      }
      details.muscle_focus = muscleFocus;
    } else if (goalDef.followup === 'frequency') {
      // days/week now comes from the info screen; endurance still picks activity.
      if (goal === 'endurance') details.endurance_activity = activity;
    }

    setLoading(true);
    try {
      await saveGoalAndFinishOnboarding(session.user.id, goal, details);
      await refreshProfile();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save.');
    } finally {
      setLoading(false);
    }
  }

  // ---- PHASE 1: pick a goal ----
  if (phase === 'pick') {
    return (
      <Screen>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={s.title}>What's your goal?</Text>
          <Text style={s.sub}>We'll build a routine and coaching around it.</Text>
          <View style={{ marginTop: theme.space(6) }}>
            {GOALS.map((g) => (
              <Pressable key={g.id} onPress={() => pick(g.id)} style={s.option}>
                <Text style={s.emoji}>{g.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.optLabel}>{g.label}</Text>
                  <Text style={s.optBlurb}>{g.blurb}</Text>
                </View>
                <Text style={s.chev}>›</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ height: theme.space(8) }} />
        </ScrollView>
      </Screen>
    );
  }

  // ---- PHASE 2: goal-specific follow-up ----
  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => { setPhase('pick'); setError(null); setWarn(null); }}>
            <Text style={s.back}>‹ Back</Text>
          </Pressable>
          <Text style={s.emojiBig}>{goalDef?.emoji}</Text>
          <Text style={s.title}>{goalDef?.label}</Text>

          {/* target weight (lose_fat / gain_weight) */}
          {goalDef?.followup === 'target_weight' && (
            <View style={{ marginTop: theme.space(5) }}>
              <Text style={s.q}>What's your target weight?</Text>
              <Text style={s.hint}>You're currently {currentKg} kg. {weeklyPaceHint(goal!, currentKg)}</Text>
              <View style={s.weightRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder={goal === 'lose_fat' ? String(Math.max(30, currentKg - 5)) : String(currentKg + 5)}
                  placeholderTextColor={theme.colors.textFaint}
                  keyboardType="numeric"
                  value={targetWeight}
                  onChangeText={(t) => { setTargetWeight(t); setWarn(null); }}
                />
                <Text style={s.unit}>kg</Text>
              </View>
            </View>
          )}

          {/* muscle focus (build_muscle) */}
          {goalDef?.followup === 'muscle_focus' && (
            <View style={{ marginTop: theme.space(5) }}>
              <Text style={s.q}>Where do you want to focus?</Text>
              <Chips
                options={[
                  { id: 'full_body', label: 'Full body' },
                  { id: 'upper', label: 'Upper body' },
                  { id: 'lower', label: 'Lower body' },
                ]}
                value={muscleFocus}
                onChange={(v) => setMuscleFocus(v as any)}
              />
            </View>
          )}

          {/* endurance activity */}
          {goalDef?.followup === 'frequency' && goal === 'endurance' && (
            <View style={{ marginTop: theme.space(5) }}>
              <Text style={s.q}>Preferred activity?</Text>
              <Chips
                options={[
                  { id: 'run', label: 'Running' },
                  { id: 'cycle', label: 'Cycling' },
                  { id: 'swim', label: 'Swimming' },
                  { id: 'mixed', label: 'Mixed' },
                ]}
                value={activity}
                onChange={(v) => setActivity(v as any)}
              />
            </View>
          )}

          {/* stay-fit has nothing extra to ask */}
          {goalDef?.followup === 'frequency' && goal === 'maintain' && (
            <Text style={[s.hint, { marginTop: theme.space(5) }]}>
              You're all set — tap below to start.
            </Text>
          )}

          {warn && (
            <View style={s.warnBox}>
              <Text style={s.warnText}>{warn}</Text>
              <Text style={s.warnSub}>Tap Continue again to keep this target anyway.</Text>
            </View>
          )}
          {error && <Text style={s.error}>{error}</Text>}

          <Button
            title="Start training"
            onPress={finish}
            loading={loading}
            style={{ marginTop: theme.space(6) }}
          />
          <View style={{ height: theme.space(8) }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.chips}>
      {options.map((o) => {
        const active = value === o.id;
        return (
          <Pressable key={o.id} onPress={() => onChange(o.id)} style={[s.chip, active && s.chipActive]}>
            <Text style={[s.chipText, active && { color: theme.colors.onAccent }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: theme.font.h1, fontWeight: '800', color: theme.colors.text, marginTop: theme.space(2) },
  sub: { fontSize: theme.font.body, color: theme.colors.textDim, marginTop: 6 },
  back: { color: theme.colors.textDim, fontSize: theme.font.body, marginTop: theme.space(6), marginBottom: theme.space(2) },
  emojiBig: { fontSize: 40, marginTop: theme.space(2) },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.space(4),
    marginBottom: theme.space(3),
  },
  emoji: { fontSize: 26, marginRight: theme.space(4) },
  optLabel: { fontSize: theme.font.h3, fontWeight: '700', color: theme.colors.text },
  optBlurb: { fontSize: theme.font.small, color: theme.colors.textDim, marginTop: 2 },
  chev: { color: theme.colors.textFaint, fontSize: 28, fontWeight: '300' },
  q: { color: theme.colors.text, fontSize: theme.font.h3, fontWeight: '700' },
  hint: { color: theme.colors.textDim, fontSize: theme.font.small, marginTop: 4, marginBottom: theme.space(3), lineHeight: 18 },
  weightRow: { flexDirection: 'row', alignItems: 'center', marginTop: theme.space(2) },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space(4),
    height: 52,
    color: theme.colors.text,
    fontSize: theme.font.h3,
  },
  unit: { color: theme.colors.textDim, fontSize: theme.font.h3, marginLeft: theme.space(3), fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: theme.space(3) },
  chip: {
    paddingHorizontal: theme.space(4),
    height: 44,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.space(2),
    marginBottom: theme.space(2),
  },
  dayChip: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.space(2),
  },
  chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipText: { color: theme.colors.text, fontWeight: '700', fontSize: theme.font.body },
  warnBox: {
    marginTop: theme.space(4),
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    padding: theme.space(3),
  },
  warnText: { color: theme.colors.warning, fontSize: theme.font.small, lineHeight: 19 },
  warnSub: { color: theme.colors.textDim, fontSize: theme.font.tiny, marginTop: 4 },
  error: { color: theme.colors.danger, fontSize: theme.font.small, marginTop: theme.space(3) },
});
