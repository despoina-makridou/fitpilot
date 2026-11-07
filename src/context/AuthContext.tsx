import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ensureProfile, getProfile } from '../lib/db';
import { Profile } from '../types';

/** Reject after `ms` if the promise hasn't settled — prevents infinite hangs. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

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
    // Each attempt is wrapped in a hard timeout so a hung Supabase RPC can
    // NEVER leave the app stuck on a loading screen. Retries a few times.
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const p = await withTimeout(ensureProfile(userId), 12000);
        setProfile(p);
        return;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    console.warn('ensureProfile failed after retries', lastErr);
    throw lastErr;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    const p = await getProfile(session.user.id);
    setProfile(p);
  }, [session]);

  useEffect(() => {
    // Seed the initial session, then let the auth listener drive everything.
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    // IMPORTANT: the callback MUST be synchronous and must NOT await any
    // Supabase call — doing so deadlocks the auth client (the callback holds
    // the auth lock while the awaited query waits for it). This was the cause
    // of the ~40s hang. We only set state here; profile loading happens in a
    // SEPARATE effect that reacts to the session change.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT') {
        if (userSignedOutRef.current) {
          setSession(null);
          setProfile(null);
        }
        return;
      }
      setSession(s);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  // Load the profile whenever the signed-in user changes. Runs OUTSIDE the
  // auth callback (so no auth-lock deadlock). Always clears `loading` when done.
  const userId = session?.user?.id;
  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        await loadProfile(userId);
      } catch (e) {
        console.warn('[auth] profile load failed', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, loadProfile]);

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
