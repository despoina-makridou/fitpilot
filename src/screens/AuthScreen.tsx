import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { signInWithGoogle } from '../lib/google';
import { GOOGLE_WEB_CLIENT_ID } from '../config';
import { Button, Screen } from '../components/ui';
import { theme } from '../theme';

export default function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configured = isSupabaseConfigured();

  async function handleEmailAuth() {
    setError(null);
    if (!email || !password) {
      setError('Enter an email and password.');
      return;
    }
    setLoading(true);
    try {
      const fn =
        mode === 'signin'
          ? supabase.auth.signInWithPassword({ email, password })
          : supabase.auth.signUp({ email, password });
      const { error } = await fn;
      if (error) setError(error.message);
      // On success, AuthContext's listener handles navigation.
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      setError(e?.message ?? 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center' }}
      >
        <Text style={s.logo}>FitPilot</Text>
        <Text style={s.tagline}>Your training, on autopilot.</Text>

        {!configured && (
          <View style={s.warn}>
            <Text style={s.warnText}>
              Supabase isn't configured yet. Add your project URL and anon key in src/config.ts.
            </Text>
          </View>
        )}

        <View style={{ height: theme.space(8) }} />

        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor={theme.colors.textFaint}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={s.input}
          placeholder="Password"
          placeholderTextColor={theme.colors.textFaint}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={s.error}>{error}</Text>}

        <Button
          title={mode === 'signin' ? 'Sign in' : 'Create account'}
          onPress={handleEmailAuth}
          loading={loading}
          disabled={!configured}
          style={{ marginTop: theme.space(3) }}
        />

        {!!GOOGLE_WEB_CLIENT_ID && (
          <Button
            title="Continue with Google"
            variant="secondary"
            onPress={handleGoogle}
            disabled={!configured || loading}
            style={{ marginTop: theme.space(3) }}
          />
        )}

        <Text
          style={s.switch}
          onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin'
            ? "No account? Create one"
            : 'Already have an account? Sign in'}
        </Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  logo: { fontSize: 40, fontWeight: '800', color: theme.colors.accent, textAlign: 'center' },
  tagline: { fontSize: theme.font.body, color: theme.colors.textDim, textAlign: 'center', marginTop: 6 },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space(4),
    height: 52,
    color: theme.colors.text,
    fontSize: theme.font.body,
    marginBottom: theme.space(3),
  },
  error: { color: theme.colors.danger, fontSize: theme.font.small, marginBottom: theme.space(2) },
  switch: { color: theme.colors.textDim, textAlign: 'center', marginTop: theme.space(5), fontSize: theme.font.small },
  warn: {
    marginTop: theme.space(4),
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: theme.space(3),
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  warnText: { color: theme.colors.warning, fontSize: theme.font.small },
});
