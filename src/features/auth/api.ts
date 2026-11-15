import type { SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { unwrap } from '@/lib/errors';

export type MyProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  ghost_mode: boolean;
  role: 'user' | 'host' | 'spotter' | 'admin';
};

/**
 * Emails a one-time code. An anonymous session is upgraded in place (its clips and votes
 * stay with the account); otherwise this signs in or signs up.
 */
export async function sendEmailCode(
  client: SupabaseClient,
  email: string,
): Promise<'upgrade' | 'signin'> {
  const { data } = await client.auth.getSession();
  if (data.session?.user.is_anonymous) {
    unwrap(await client.auth.updateUser({ email: email.trim() }));
    return 'upgrade';
  }
  unwrap(
    await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } }),
  );
  return 'signin';
}

export async function verifyEmailCode(
  client: SupabaseClient,
  email: string,
  code: string,
  mode: 'upgrade' | 'signin',
): Promise<void> {
  unwrap(
    await client.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: mode === 'upgrade' ? 'email_change' : 'email',
    }),
  );
}

/** Google / Apple via the browser (PKCE). Providers are switched on in the Supabase dashboard. */
export async function signInWithProvider(
  client: SupabaseClient,
  provider: 'google' | 'apple',
): Promise<boolean> {
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('No sign-in URL');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;
  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new Error('Sign-in was cancelled');
  unwrap(await client.auth.exchangeCodeForSession(code));
  return true;
}

export async function fetchMyProfile(client: SupabaseClient): Promise<MyProfile | null> {
  const rows = unwrap(await client.rpc('my_profile')) as MyProfile[] | null;
  return rows?.[0] ?? null;
}

export async function saveProfile(
  client: SupabaseClient,
  username: string,
  displayName: string,
  birthdateIso: string,
): Promise<void> {
  unwrap(
    await client.rpc('upsert_my_profile', {
      p_username: username,
      p_display_name: displayName,
      p_birthdate: birthdateIso,
    }),
  );
}
