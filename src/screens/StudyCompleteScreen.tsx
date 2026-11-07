import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Button, Screen } from '../components/ui';
import { theme } from '../theme';

/**
 * Shown once the user has finished the 15-day trial AND submitted the
 * questionnaire. The study is complete — the app no longer collects data.
 */
export default function StudyCompleteScreen() {
  const { signOut } = useAuth();
  return (
    <Screen>
      <View style={s.center}>
        <Text style={s.emoji}>🎉</Text>
        <Text style={s.title}>Study complete</Text>
        <Text style={s.sub}>
          Thank you for taking part in FitPilot. Your contribution really helps —
          you're all done here.
        </Text>
      </View>
      <Button title="Sign out" variant="secondary" onPress={signOut} />
      <View style={{ height: theme.space(4) }} />
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.space(6) },
  emoji: { fontSize: 56, marginBottom: theme.space(4) },
  title: { fontSize: theme.font.h1, fontWeight: '800', color: theme.colors.text, textAlign: 'center' },
  sub: { fontSize: theme.font.body, color: theme.colors.textDim, marginTop: theme.space(3), textAlign: 'center', lineHeight: 23 },
});
