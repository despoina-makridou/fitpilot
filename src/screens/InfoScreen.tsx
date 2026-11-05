import React, { useState } from 'react';
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
import { saveUserInfo } from '../lib/db';
import { FITNESS_LEVELS, FitnessLevel, Sex, UserInfo } from '../types';
import { Button, Screen } from '../components/ui';
import { theme } from '../theme';

/**
 * First real onboarding step (after consent): collect the info the app + AI
 * coach use to give realistic, personalized guidance (e.g. safe target weights).
 */
export default function InfoScreen() {
  const { session, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [level, setLevel] = useState<FitnessLevel | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): UserInfo | null {
    const a = parseInt(age, 10);
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (!name.trim()) return err('Please enter your name.');
    if (!a || a < 13 || a > 100) return err('Enter a valid age (13–100).');
    if (!sex) return err('Please select your sex.');
    if (!h || h < 120 || h > 230) return err('Enter a valid height in cm (120–230).');
    if (!w || w < 30 || w > 300) return err('Enter a valid weight in kg (30–300).');
    if (!level) return err('Please select your fitness level.');
    if (!days) return err('Please select how many days per week you can train.');
    return {
      name: name.trim(),
      age: a,
      sex,
      height_cm: h,
      weight_kg: w,
      fitness_level: level,
      days_per_week: days,
    };
  }
  function err(msg: string): null {
    setError(msg);
    return null;
  }

  async function next() {
    setError(null);
    const info = validate();
    if (!info || !session?.user) return;
    setLoading(true);
    try {
      await saveUserInfo(session.user.id, info);
      await refreshProfile();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>About you</Text>
          <Text style={s.sub}>We use this to tailor realistic goals and coaching.</Text>

          <Field label="Name">
            <TextInput
              style={s.input}
              placeholder="Your name"
              placeholderTextColor={theme.colors.textFaint}
              value={name}
              onChangeText={setName}
            />
          </Field>

          <View style={s.row}>
            <Field label="Age" style={{ flex: 1, marginRight: theme.space(2) }}>
              <TextInput
                style={s.input}
                placeholder="25"
                placeholderTextColor={theme.colors.textFaint}
                keyboardType="number-pad"
                value={age}
                onChangeText={setAge}
              />
            </Field>
            <Field label="Height (cm)" style={{ flex: 1, marginLeft: theme.space(2) }}>
              <TextInput
                style={s.input}
                placeholder="175"
                placeholderTextColor={theme.colors.textFaint}
                keyboardType="numeric"
                value={height}
                onChangeText={setHeight}
              />
            </Field>
          </View>

          <Field label="Current weight (kg)">
            <TextInput
              style={s.input}
              placeholder="70"
              placeholderTextColor={theme.colors.textFaint}
              keyboardType="numeric"
              value={weight}
              onChangeText={setWeight}
            />
          </Field>

          <Field label="Sex">
            <View style={s.row}>
              {(['male', 'female', 'other'] as Sex[]).map((opt) => {
                const active = sex === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setSex(opt)}
                    style={[s.pill, active && s.pillActive, { flex: 1, marginHorizontal: 3 }]}
                  >
                    <Text style={[s.pillText, active && { color: theme.colors.onAccent }]}>
                      {opt === 'male' ? 'Male' : opt === 'female' ? 'Female' : 'Other'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label="Current fitness level">
            {FITNESS_LEVELS.map((lvl) => {
              const active = level === lvl.id;
              return (
                <Pressable
                  key={lvl.id}
                  onPress={() => setLevel(lvl.id)}
                  style={[s.levelRow, active && s.pillActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.levelLabel, active && { color: theme.colors.onAccent }]}>{lvl.label}</Text>
                    <Text style={[s.levelSub, active && { color: theme.colors.onAccent }]}>{lvl.sub}</Text>
                  </View>
                  <View style={[s.radio, active && s.radioOn]} />
                </Pressable>
              );
            })}
          </Field>

          <Field label="How many days per week can you train?">
            <View style={s.row}>
              {[
                { n: 2, label: '2' },
                { n: 3, label: '3' },
                { n: 4, label: '4' },
                { n: 5, label: '5+' },
              ].map((d) => {
                const active = days === d.n;
                return (
                  <Pressable
                    key={d.n}
                    onPress={() => setDays(d.n)}
                    style={[s.pill, active && s.pillActive, { flex: 1, marginHorizontal: 3 }]}
                  >
                    <Text style={[s.pillText, active && { color: theme.colors.onAccent }]}>{d.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          {error && <Text style={s.error}>{error}</Text>}

          <Button
            title="Continue"
            onPress={next}
            loading={loading}
            style={{ marginTop: theme.space(5) }}
          />
          <View style={{ height: theme.space(8) }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View style={[{ marginTop: theme.space(4) }, style]}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: theme.font.h1, fontWeight: '800', color: theme.colors.text, marginTop: theme.space(6) },
  sub: { fontSize: theme.font.body, color: theme.colors.textDim, marginTop: 6 },
  label: { color: theme.colors.textDim, fontSize: theme.font.small, marginBottom: 6, fontWeight: '600' },
  row: { flexDirection: 'row' },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space(4),
    height: 52,
    color: theme.colors.text,
    fontSize: theme.font.body,
  },
  pill: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  pillText: { color: theme.colors.text, fontWeight: '700', fontSize: theme.font.body },
  error: { color: theme.colors.danger, fontSize: theme.font.small, marginTop: theme.space(3) },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.space(4),
    marginBottom: theme.space(2),
  },
  levelLabel: { color: theme.colors.text, fontWeight: '700', fontSize: theme.font.body },
  levelSub: { color: theme.colors.textDim, fontSize: theme.font.small, marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.colors.textFaint },
  radioOn: { borderColor: theme.colors.onAccent, backgroundColor: theme.colors.onAccent },
});
