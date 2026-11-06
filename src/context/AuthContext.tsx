import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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

  // True only while an explicit, user-initiated sign-out is in progress, so we
  // can tell a real logout apart from a transient refresh failure.
  const userSignedOutRef = useRef(false);

  const loadProfile = useCallback(async (userId: string) => {
    // Ensure a profile (auto-assigns a balanced study group on first login).
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

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      // Keep the user logged in unless THEY sign out. A transient
      // TOKEN_REFRESH_FAILED (offline, DB paused, flaky network) must NOT drop
      // the session — otherwise the app force-logs-out on a network blip.
      // We only clear on an explicit user-initiated sign-out.
      if (event === 'SIGNED_OUT') {
        // A SIGNED_OUT fires both on a real sign-out AND when a background
        // token refresh fails (offline / DB paused). Only actually clear the
        // session if the USER initiated it; otherwise keep them logged in.
        if (userSignedOutRef.current) {
          setSession(null);
          setProfile(null);
        }
        return;
      }

      setSession(s);
      if (s?.user) {
        try {
          await loadProfile(s.user.id);
        } catch (e) {
          console.warn('profile load failed', e);
        }
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    userSignedOutRef.current = true;
    try {
      await supabase.auth.signOut();
    } finally {
      setSession(null);
      setProfile(null);
      // Reset the flag shortly after so future transient events are ignored.
      setTimeout(() => {
        userSignedOutRef.current = false;
      }, 1000);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ loading, session, profile, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
