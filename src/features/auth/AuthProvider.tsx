import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { identify } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';

import { fetchMyProfile, type MyProfile } from './api';

export const profileKey = ['my-profile'] as const;

type AuthValue = {
  loading: boolean;
  session: Session | null;
  userId: string | null;
  /** Signed in with email / Google / Apple (not just an anonymous session). */
  hasAccount: boolean;
  profile: MyProfile | null;
  refetchProfile: () => Promise<unknown>;
};

const AuthContext = createContext<AuthValue | null>(null);

/** One auth listener for the whole app; screens read it with useAuth(). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setSession(data.session);
      })
      .finally(() => mounted && setLoading(false));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user) identify(next.user.id);
      void queryClient.invalidateQueries({ queryKey: profileKey });
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const hasAccount = !!session && !session.user.is_anonymous;
  const profile = useQuery({
    queryKey: profileKey,
    queryFn: () => fetchMyProfile(supabase),
    enabled: hasAccount,
  });

  const value = useMemo<AuthValue>(
    () => ({
      loading: loading || (hasAccount && profile.isPending),
      session,
      userId: session?.user.id ?? null,
      hasAccount,
      profile: profile.data ?? null,
      refetchProfile: profile.refetch,
    }),
    [loading, hasAccount, profile.isPending, profile.data, profile.refetch, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
