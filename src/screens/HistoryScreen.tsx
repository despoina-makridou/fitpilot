import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { recentLogs } from '../lib/db';
import { computePoints, SessionPoints } from '../lib/points';
import { AdherenceLog, Outcome } from '../types';
import { Screen } from '../components/ui';
import { theme } from '../theme';

/**
 * History — every workout the user logged (completed, partial, or skipped),
 * newest first. Scheduled or not; this is their full record.
 */
export default function HistoryScreen() {
  const { session, profile } = useAuth();
  const [logs, setLogs] = useState<AdherenceLog[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    try {
      const l = await recentLogs(session.user.id, 200);
      setLogs(l);
    } catch {
      // keep whatever we have
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Reload each time the tab is focused so new workouts show up.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const completed = logs.filter((l) => l.outcome === 'completed').length;
  const totalMinutes = logs.reduce((sum, l) => sum + (l.minutes || 0), 0);

  // Points per session (newest first for display; compute then reverse-map).
  const startISO = profile?.created_at ?? new Date().toISOString();
  const pointsByLog = new Map<AdherenceLog, SessionPoints>();
  for (const sp of computePoints(logs, startISO)) pointsByLog.set(sp.log, sp);
  const totalPts = [...pointsByLog.values()].reduce((s, p) => s + p.points, 0);

  return (
    <Screen>
      <Text style={s.title}>History</Text>

      <View style={s.summaryRow}>
        <Summary value={String(totalPts)} label="points" />
        <Summary value={String(completed)} label="completed" />
        <Summary value={String(totalMinutes)} label="total min" />
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item, i) => item.id ?? String(i)}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.colors.accent} />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={s.empty}>No workouts logged yet. Start one from the Exercise tab.</Text>
          ) : null
        }
        renderItem={({ item }) => <Row log={item} pts={pointsByLog.get(item)} />}
        contentContainerStyle={{ paddingBottom: theme.space(8) }}
      />
    </Screen>
  );
}

function Summary({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.summary}>
      <Text style={s.summaryValue}>{value}</Text>
      <Text style={s.summaryLabel}>{label}</Text>
    </View>
  );
}

function Row({ log, pts }: { log: AdherenceLog; pts?: SessionPoints }) {
  const o = outcomeStyle(log.outcome);
  return (
    <View style={s.row}>
      <View style={[s.badge, { backgroundColor: o.bg }]}>
        <Text style={s.badgeIcon}>{o.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{log.item_title}</Text>
        <Text style={s.rowMeta}>
          {log.outcome === 'skipped'
            ? 'Skipped'
            : `${log.minutes} min${log.target_minutes ? ` / ${log.target_minutes} target` : ''}`}
          {'  ·  '}
          {formatDate(log.logged_at)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {pts && pts.points > 0 ? (
          <Text style={s.points}>
            +{pts.points}
            {pts.streak > 0 ? <Text style={s.streak}> (+{pts.streak} streak)</Text> : null}
          </Text>
        ) : (
          <Text style={[s.outcomeText, { color: o.color }]}>{o.text}</Text>
        )}
      </View>
    </View>
  );
}

function outcomeStyle(o: Outcome) {
  switch (o) {
    case 'completed':
      return { icon: '✅', text: 'Done', color: theme.colors.success, bg: 'rgba(74,222,128,0.12)' };
    case 'partial':
      return { icon: '⚠️', text: 'Partial', color: theme.colors.warning, bg: 'rgba(251,191,36,0.12)' };
    default:
      return { icon: '❌', text: 'Skipped', color: theme.colors.danger, bg: 'rgba(248,113,113,0.12)' };
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const s = StyleSheet.create({
  title: { fontSize: theme.font.h1, fontWeight: '800', color: theme.colors.text, marginTop: theme.space(6), marginBottom: theme.space(4) },
  summaryRow: { flexDirection: 'row', marginBottom: theme.space(5) },
  summary: {
    flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border, paddingVertical: theme.space(3),
    alignItems: 'center', marginHorizontal: 3,
  },
  summaryValue: { color: theme.colors.accent, fontSize: theme.font.h2, fontWeight: '800' },
  summaryLabel: { color: theme.colors.textDim, fontSize: theme.font.tiny, marginTop: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: theme.space(3),
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: theme.space(3) },
  badgeIcon: { fontSize: 18 },
  rowTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '700' },
  rowMeta: { color: theme.colors.textDim, fontSize: theme.font.small, marginTop: 2 },
  outcomeText: { fontSize: theme.font.small, fontWeight: '700', marginLeft: theme.space(2) },
  points: { color: theme.colors.accent, fontSize: theme.font.body, fontWeight: '800' },
  streak: { color: theme.colors.textDim, fontSize: theme.font.tiny, fontWeight: '600' },
  empty: { color: theme.colors.textFaint, fontSize: theme.font.body, textAlign: 'center', marginTop: theme.space(10), lineHeight: 22 },
});
