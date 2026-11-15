import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { DemoBackend } from './demoBackend';
import { env } from './env';

export function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      // Web keeps the default localStorage; native persists the session in AsyncStorage.
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
    },
  });
}

/** Set in demo mode: the local stand-in backend (see demoBackend.ts). */
export const demoBackend = env.demoMode ? new DemoBackend() : null;

// Without the Supabase keys the app talks to the local demo backend instead, so every
// screen works without signing in.
export const supabase: SupabaseClient =
  demoBackend?.asClient() ?? createSupabaseClient(env.supabaseUrl, env.supabaseAnonKey);

/**
 * Makes sure there is a session. Until accounts land (Phase 3) every visitor gets an
 * anonymous session, which later upgrades to a full account without losing data.
 */
export async function ensureSession(client: SupabaseClient = supabase): Promise<string> {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session.user.id;

  const signIn = await client.auth.signInAnonymously();
  if (signIn.error) throw signIn.error;
  if (!signIn.data.user) throw new Error('Anonymous sign-in returned no user');
  return signIn.data.user.id;
}
