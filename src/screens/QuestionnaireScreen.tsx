import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { fetchQuestions, submitQuestionnaire } from '../lib/db';
import { Question } from '../types';
import { Button, Screen } from '../components/ui';
import { theme } from '../theme';

/**
 * End-of-trial questionnaire. Questions are DEFINED IN THE DATABASE
 * (questionnaire_questions) so they can be finalized later without an app
 * update. If none exist yet, we show a friendly "coming soon" hold screen and
 * re-check on next open. Data collection is already stopped by this point.
 */
export default function QuestionnaireScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchQuestions()
      .then(setQuestions)
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false));
  }, []);

  function setAnswer(qid: string, value: string) {
    setAnswers((a) => ({ ...a, [qid]: value }));
  }

  async function submit() {
    setError(null);
    const missing = questions.filter((q) => q.required && !answers[q.id]?.trim());
    if (missing.length) {
      setError('Please answer all required questions.');
      return;
    }
    if (!session?.user || !profile) return;
    setSaving(true);
    try {
      const payload = questions
        .filter((q) => answers[q.id] != null)
        .map((q) => ({ question_id: q.id, answer: answers[q.id] }));
      await submitQuestionnaire(session.user.id, profile.group, payload);
      await refreshProfile(); // flips to StudyComplete
    } catch (e: any) {
      setError(e?.message ?? 'Could not submit.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <View style={s.center}>
          <ActivityIndicator color={theme.colors.accent} size="large" />
        </View>
      </Screen>
    );
  }

  // No questions defined yet → friendly hold screen.
  if (questions.length === 0) {
    return (
      <Screen>
        <View style={s.center}>
          <Text style={s.emoji}>📝</Text>
          <Text style={s.title}>Your 15 days are complete!</Text>
          <Text style={s.sub}>
            Thank you for taking part. A short questionnaire will be available
            here shortly — please check back soon.
          </Text>
          <Text style={s.note}>Your workout data collection has ended.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>One last thing</Text>
          <Text style={s.sub}>Your 15 days are done — please share your experience.</Text>

          {questions.map((q, i) => (
            <View key={q.id} style={s.qBlock}>
              <Text style={s.prompt}>
                {i + 1}. {q.prompt}
                {q.required ? <Text style={{ color: theme.colors.accent }}> *</Text> : null}
              </Text>
              {renderInput(q, answers[q.id], (v) => setAnswer(q.id, v))}
            </View>
          ))}

          {error && <Text style={s.error}>{error}</Text>}

          <Button title="Submit" onPress={submit} loading={saving} style={{ marginTop: theme.space(6) }} />
          <View style={{ height: theme.space(10) }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function renderInput(q: Question, value: string | undefined, onChange: (v: string) => void) {
  if (q.qtype === 'scale') {
    const opts = (q.options as { min?: number; max?: number }) ?? {};
    const min = opts.min ?? 1;
    const max = opts.max ?? 5;
    const nums = Array.from({ length: max - min + 1 }, (_, k) => min + k);
    return (
      <View style={s.scaleRow}>
        {nums.map((n) => {
          const active = value === String(n);
          return (
            <Pressable key={n} onPress={() => onChange(String(n))} style={[s.scaleBtn, active && s.activeBg]}>
              <Text style={[s.scaleText, active && { color: theme.colors.onAccent }]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  if (q.qtype === 'choice') {
    const opts = (q.options as string[]) ?? [];
    return (
      <View style={{ marginTop: theme.space(2) }}>
        {opts.map((opt) => {
          const active = value === opt;
          return (
            <Pressable key={opt} onPress={() => onChange(opt)} style={[s.choice, active && s.activeBg]}>
              <Text style={[s.choiceText, active && { color: theme.colors.onAccent }]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  // text
  return (
    <TextInput
      style={s.textInput}
      placeholder="Your answer"
      placeholderTextColor={theme.colors.textFaint}
      multiline
      value={value ?? ''}
      onChangeText={onChange}
    />
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.space(6) },
  emoji: { fontSize: 48, marginBottom: theme.space(3) },
  title: { fontSize: theme.font.h1, fontWeight: '800', color: theme.colors.text, marginTop: theme.space(6), textAlign: 'center' },
  sub: { fontSize: theme.font.body, color: theme.colors.textDim, marginTop: 6, textAlign: 'center', lineHeight: 22 },
  note: { fontSize: theme.font.small, color: theme.colors.textFaint, marginTop: theme.space(5), textAlign: 'center' },
  qBlock: { marginTop: theme.space(6) },
  prompt: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '600', lineHeight: 22 },
  scaleRow: { flexDirection: 'row', marginTop: theme.space(3) },
  scaleBtn: {
    flex: 1, height: 48, marginHorizontal: 3, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  scaleText: { color: theme.colors.text, fontWeight: '700', fontSize: theme.font.h3 },
  choice: {
    padding: theme.space(4), borderRadius: theme.radius.md, marginBottom: theme.space(2),
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
  },
  choiceText: { color: theme.colors.text, fontSize: theme.font.body },
  activeBg: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  textInput: {
    marginTop: theme.space(2), minHeight: 90, backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    padding: theme.space(4), color: theme.colors.text, fontSize: theme.font.body, textAlignVertical: 'top',
  },
  error: { color: theme.colors.danger, fontSize: theme.font.small, marginTop: theme.space(4) },
});
