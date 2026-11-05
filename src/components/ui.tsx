import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { theme } from '../theme';

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        s.btn,
        variant === 'primary' && s.btnPrimary,
        variant === 'secondary' && s.btnSecondary,
        variant === 'ghost' && s.btnGhost,
        variant === 'danger' && s.btnDanger,
        isDisabled && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.colors.onAccent : theme.colors.text} />
      ) : (
        <Text
          style={[
            s.btnText,
            variant === 'primary' && { color: theme.colors.onAccent },
            (variant === 'secondary' || variant === 'ghost') && { color: theme.colors.text },
            variant === 'danger' && { color: theme.colors.danger },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.screen, style]}>{children}</View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.space(5) },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space(5),
  },
  btn: {
    height: 52,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space(6),
  },
  btnPrimary: { backgroundColor: theme.colors.accent },
  btnSecondary: { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border },
  btnGhost: { backgroundColor: 'transparent' },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.danger },
  btnText: { fontSize: theme.font.body, fontWeight: '700', color: theme.colors.text },
});
