import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { saveConsent } from '../lib/db';
import { Button, Card, Screen } from '../components/ui';
import { theme } from '../theme';

/**
 * Research data-collection consent. Shown once, right after first login,
 * before any data is collected. User must accept to continue.
 */
export default function ConsentScreen() {
  const { session, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  async function accept() {
    if (!session?.user) return;
    setLoading(true);
    try {
      await saveConsent(session.user.id);
      await refreshProfile();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Before we start</Text>
        <Text style={s.sub}>
          FitPilot is part of a study on workout habits.
        </Text>

        <Card style={{ marginTop: theme.space(5) }}>
          <Text style={s.h}>What we collect</Text>
          <Bullet>Your fitness goal (to pick a workout schedule).</Bullet>
          <Bullet>When you start a workout and how long you exercise.</Bullet>
          <Bullet>Whether you completed, partly did, or skipped each session.</Bullet>

          <Text style={[s.h, { marginTop: theme.space(5) }]}>What we DON'T collect</Text>
          <Bullet>No health metrics, weight, age, location, or contacts.</Bullet>
          <Bullet>Your personal details stay on your device — only a nickname identifies you in the study.</Bullet>

          <Text style={[s.h, { marginTop: theme.space(5) }]}>How it's used</Text>
          <Bullet>
            Only to study whether reminders help people stay on schedule. Data is
            stored against an anonymous account id and used for research only.
          </Bullet>
        </Card>

        <Text style={s.fine}>
          You can stop and delete your account at any time. By continuing you
          agree to take part in this study.
        </Text>

        <Button
          title="I agree — continue"
          onPress={accept}
          loading={loading}
          style={{ marginTop: theme.space(5) }}
        />
        <View style={{ height: theme.space(8) }} />
      </ScrollView>
    </Screen>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.bulletRow}>
      <View style={s.dot} />
      <Text style={s.bulletText}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: theme.font.h1, fontWeight: '800', color: theme.colors.text, marginTop: theme.space(6) },
  sub: { fontSize: theme.font.body, color: theme.colors.textDim, marginTop: 6 },
  h: { fontSize: theme.font.h3, fontWeight: '700', color: theme.colors.accent, marginBottom: theme.space(2) },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: theme.space(2) },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.accent, marginTop: 7, marginRight: 10 },
  bulletText: { flex: 1, color: theme.colors.text, fontSize: theme.font.body, lineHeight: 21 },
  fine: { color: theme.colors.textFaint, fontSize: theme.font.small, marginTop: theme.space(4), lineHeight: 18 },
});
