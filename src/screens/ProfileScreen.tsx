import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { GOALS } from '../types';
import { Button, Card, Screen } from '../components/ui';
import { theme } from '../theme';

export default function ProfileScreen() {
  const { session, profile, signOut } = useAuth();
  const goalLabel = GOALS.find((g) => g.id === profile?.goal)?.label ?? '—';

  return (
    <Screen>
      <Text style={s.title}>Profile</Text>

      <Card style={{ marginTop: theme.space(5) }}>
        <Row label="Email" value={session?.user?.email ?? '—'} />
        <Row label="Goal" value={goalLabel} />
        <Row
          label="Study mode"
          value={profile?.group === 'ai' ? 'AI coaching' : profile?.group === 'non_ai' ? 'Standard' : '—'}
        />
      </Card>

      <Text style={s.note}>
        You're part of a research study. Your study mode was assigned
        automatically to keep the two groups balanced.
      </Text>

      <View style={{ flex: 1 }} />
      <Button title="Sign out" variant="danger" onPress={signOut} />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  title: { color: theme.colors.text, fontSize: theme.font.h1, fontWeight: '800', marginTop: theme.space(6) },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.space(3), borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowLabel: { color: theme.colors.textDim, fontSize: theme.font.body },
  rowValue: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '600' },
  note: { color: theme.colors.textFaint, fontSize: theme.font.small, marginTop: theme.space(4), lineHeight: 18 },
});
