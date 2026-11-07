import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';

/**
 * Supabase client configured for React Native:
 *  - AsyncStorage persists the session across app restarts (never expires as
 *    long as we keep refreshing), so users stay logged in.
 *  - autoRefreshToken keeps the access token fresh in the background.
 *  - detectSessionInUrl is false (no browser URL to parse on native).
 *  - lock: processLock — CRITICAL on React Native. Without an explicit lock,
 *    supabase-js falls back to a navigator LockManager that doesn't exist in
 *    RN, causing a DEADLOCK: a token refresh (fires TOKEN_REFRESHED right after
 *    login) holds the auth lock while the first query (getProfile) waits on it,
 *    so the first request after sign-in hangs ~30-40s. processLock fixes it.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

export function isSupabaseConfigured(): boolean {
  return (
    !SUPABASE_URL.includes('YOUR_PROJECT_REF') &&
    !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY')
  );
}
