import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

/** Explains how the points system works. */
export function PointsInfoModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <Text style={s.title}>How points work</Text>

          <Text style={s.h}>Per workout</Text>
          <Text style={s.p}>
            You earn up to <Text style={s.b}>10 points</Text> based on how much of
            your target you complete. Do half your target → ~5 points. Finish it →
            10 points.
          </Text>

          <Text style={s.h}>Consistency bonus</Text>
          <Text style={s.p}>
            Each workout you do in the same week adds a growing bonus:
          </Text>
          <Text style={s.bullet}>• 1st workout: +0</Text>
          <Text style={s.bullet}>• 2nd workout: +1</Text>
          <Text style={s.bullet}>• 3rd workout: +2, and so on…</Text>
          <Text style={s.p}>
            So the more you show up, the more each workout is worth. Weeks are
            counted from the day you started.
          </Text>

          <Text style={s.h}>Skipping</Text>
          <Text style={s.p}>
            Missed or skipped sessions earn 0 points and don't add to your bonus —
            showing up is what counts.
          </Text>

          <Pressable style={s.btn} onPress={onClose}>
            <Text style={s.btnText}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: theme.space(5) },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border, padding: theme.space(5),
  },
  title: { color: theme.colors.text, fontSize: theme.font.h2, fontWeight: '800', marginBottom: theme.space(3) },
  h: { color: theme.colors.accent, fontSize: theme.font.body, fontWeight: '700', marginTop: theme.space(3), marginBottom: 4 },
  p: { color: theme.colors.text, fontSize: theme.font.small, lineHeight: 20 },
  b: { fontWeight: '800', color: theme.colors.accent },
  bullet: { color: theme.colors.textDim, fontSize: theme.font.small, lineHeight: 20, marginLeft: theme.space(2) },
  btn: {
    marginTop: theme.space(5), height: 48, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  btnText: { color: theme.colors.onAccent, fontWeight: '800', fontSize: theme.font.body },
});
