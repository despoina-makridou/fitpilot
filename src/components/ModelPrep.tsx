import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { initLLM } from '../ai/llm';
import { isModelReady } from '../ai/model';
import { theme } from '../theme';

/**
 * First-launch model preparation overlay for the AI arm. Reassembling the
 * bundled ~490MB model from chunks (and loading it) takes a little while the
 * first time, so we show progress instead of a silent stall. On later launches
 * the model is already on disk and this returns instantly.
 *
 * Renders `children` once the model is ready (or if it fails — we don't block
 * the app, the brain has fallbacks).
 */
export function ModelPrep({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState<boolean>(() => isModelReady());
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (ready) return;
    let alive = true;
    initLLM((p) => alive && setProgress(p))
      .then(() => alive && setReady(true))
      .catch(() => {
        // Don't block the app — fall through to children; brain uses fallbacks.
        if (alive) {
          setFailed(true);
          setReady(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [ready]);

  if (ready) return <>{children}</>;

  const pct = Math.round(progress * 100);
  return (
    <View style={s.wrap}>
      <Text style={s.logo}>FitPilot</Text>
      <ActivityIndicator color={theme.colors.accent} size="large" style={{ marginVertical: theme.space(5) }} />
      <Text style={s.title}>Setting up your AI coach</Text>
      <Text style={s.sub}>Preparing the on-device model. This happens once.</Text>
      <View style={s.track}>
        <View style={[s.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={s.pct}>{pct}%</Text>
      {failed && <Text style={s.warn}>Couldn't load the model — continuing without it.</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center', padding: theme.space(8) },
  logo: { fontSize: 34, fontWeight: '800', color: theme.colors.accent },
  title: { fontSize: theme.font.h3, fontWeight: '700', color: theme.colors.text, marginTop: theme.space(2) },
  sub: { fontSize: theme.font.small, color: theme.colors.textDim, marginTop: 6, textAlign: 'center' },
  track: { width: '80%', height: 8, borderRadius: 4, backgroundColor: theme.colors.surfaceAlt, marginTop: theme.space(5), overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: theme.colors.accent },
  pct: { color: theme.colors.textDim, fontSize: theme.font.small, marginTop: theme.space(2) },
  warn: { color: theme.colors.warning, fontSize: theme.font.small, marginTop: theme.space(4), textAlign: 'center' },
});
