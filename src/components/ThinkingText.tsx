import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { theme } from '../theme';

/**
 * A playful "thinking…" line that rotates through funny status messages every
 * second while the AI is working. Purely cosmetic — makes the on-device model's
 * think time feel intentional and fun instead of like a stall.
 */
const MESSAGES = [
  'Dreaming up ideas…',
  'Mixing the pixels…',
  'Crafting your response…',
  'Crunching the data…',
  'Evaluating options…',
  'Running calculations…',
  'Consulting the gains…',
  'Warming up the neurons…',
  'Reading your vibe…',
  'Summoning motivation…',
  'Doing a few reps…',
  'Almost there…',
];

export function ThinkingText({ style }: { style?: TextStyle }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    // Shuffle the start so it isn't always the same first line.
    setI(Math.floor(Math.random() * MESSAGES.length));
    const id = setInterval(() => setI((x) => (x + 1) % MESSAGES.length), 1000);
    return () => clearInterval(id);
  }, []);
  return <Text style={[s.text, style]}>{MESSAGES[i]}</Text>;
}

const s = StyleSheet.create({
  text: { color: theme.colors.textDim, fontSize: theme.font.body, fontStyle: 'italic' },
});
