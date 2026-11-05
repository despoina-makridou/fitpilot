import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { saveEquipment } from '../lib/db';
import { EQUIPMENT_OPTIONS, Equipment } from '../lib/exercises';
import { Button, Screen } from '../components/ui';
import { theme } from '../theme';

/**
 * Equipment / space selection. Shown after the info screen, before goal.
 * Multi-select. Whatever they tick here is later intersected with their chosen
 * goal to produce the exercises available in workout mode.
 */
export default function EquipmentScreen() {
  const { session, refreshProfile } = useAuth();
  const [selected, setSelected] = useState<Set<Equipment>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggle(id: Equipment) {
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function next() {
    if (!session?.user) return;
    if (selected.size === 0) {
      setError('Pick at least one — even just "Open space".');
      return;
    }
    setLoading(true);
    try {
      await saveEquipment(session.user.id, [...selected]);
      await refreshProfile();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={s.title}>What do you have?</Text>
        <Text style={s.sub}>
          Tick the space and gear you can use. We'll only suggest exercises you
          can actually do.
        </Text>

        <View style={s.grid}>
          {EQUIPMENT_OPTIONS.map((opt) => {
            const active = selected.has(opt.id);
            return (
              <Pressable
                key={opt.id}
                onPress={() => toggle(opt.id)}
                style={[s.tile, active && s.tileActive]}
              >
                <Text style={s.tileEmoji}>{opt.emoji}</Text>
                <Text style={[s.tileLabel, active && { color: theme.colors.onAccent }]}>
                  {opt.label}
                </Text>
                <View style={[s.check, active && s.checkOn]}>
                  {active && <Text style={s.checkMark}>✓</Text>}
                </View>
              </Pressable>
            );
          })}
        </View>

        {error && <Text style={s.error}>{error}</Text>}

        <Button
          title={`Continue${selected.size ? ` (${selected.size})` : ''}`}
          onPress={next}
          loading={loading}
          style={{ marginTop: theme.space(5) }}
        />
        <View style={{ height: theme.space(8) }} />
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { fontSize: theme.font.h1, fontWeight: '800', color: theme.colors.text, marginTop: theme.space(6) },
  sub: { fontSize: theme.font.body, color: theme.colors.textDim, marginTop: 6, lineHeight: 21 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: theme.space(5),
  },
  tile: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.space(4),
    marginBottom: theme.space(3),
    minHeight: 92,
  },
  tileActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  tileEmoji: { fontSize: 24 },
  tileLabel: { color: theme.colors.text, fontWeight: '700', fontSize: theme.font.small, marginTop: theme.space(2) },
  check: {
    position: 'absolute',
    top: theme.space(3),
    right: theme.space(3),
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: theme.colors.onAccent, borderColor: theme.colors.onAccent },
  checkMark: { color: theme.colors.accent, fontSize: 13, fontWeight: '900' },
  error: { color: theme.colors.danger, fontSize: theme.font.small, marginTop: theme.space(2) },
});
