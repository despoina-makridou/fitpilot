import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ensureProfile, getProfile } from '../lib/db';
import { Profile } from '../types';

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  /** Re-read the profile from the server (after onboarding steps). */
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  loading: true,
  session: null,
  profile: null,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    // Ensure a profile (assigns study group on first login), then hold it.
    const p = await ensureProfile(userId);
    setProfile(p);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    const p = await getProfile(session.user.id);
    setProfile(p);
  }, [session]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      try {
        if (data.session?.user) await loadProfile(data.session.user.id);
      } catch (e) {
        console.warn('profile load failed', e);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s?.user) {
        try {
          await loadProfile(s.user.id);
        } catch (e) {
          console.warn('profile load failed', e);
        }
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ loading, session, profile, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
