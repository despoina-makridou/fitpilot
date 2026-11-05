import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';

/**
 * Supabase client configured for React Native:
 *  - AsyncStorage persists the session across app restarts (never expires as
 *    long as we keep refreshing), so users stay logged in.
 *  - autoRefreshToken keeps the access token fresh in the background.
 *  - detectSessionInUrl is false (no browser URL to parse on native).
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function isSupabaseConfigured(): boolean {
  return (
    !SUPABASE_URL.includes('YOUR_PROJECT_REF') &&
    !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY')
  );
}
