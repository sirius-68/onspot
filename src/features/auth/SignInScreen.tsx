import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field } from '@/components/ui';
import { track } from '@/lib/analytics';
import { errorText } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, spacing, typography } from '@/theme/tokens';

import { sendEmailCode, signInWithProvider, verifyEmailCode } from './api';
import { isValidEmail } from './validation';

/** Email one-time code, Google or Apple. After sign-in, new users set up their profile. */
export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'upgrade' | 'signin' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e, e instanceof Error ? e.message : 'Sign-in failed'));
    } finally {
      setBusy(false);
    }
  }

  const done = () => {
    track('signed_in');
    router.replace('/onboarding');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Join Onspot</Text>
          <Text style={styles.body}>
            Sign in to post live clips, add friends and start squad votes. 18+ only.
          </Text>

          {mode === null ? (
            <>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
              />
              <Button
                title="Email me a code"
                disabled={!isValidEmail(email)}
                loading={busy}
                onPress={() =>
                  run(async () => {
                    setMode(await sendEmailCode(supabase, email));
                  })
                }
              />
              <Text style={styles.or}>or</Text>
              <Button
                title="Continue with Google"
                variant="secondary"
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    if (await signInWithProvider(supabase, 'google')) done();
                  })
                }
              />
              {Platform.OS === 'ios' && (
                <Button
                  title="Continue with Apple"
                  variant="secondary"
                  disabled={busy}
                  onPress={() =>
                    run(async () => {
                      if (await signInWithProvider(supabase, 'apple')) done();
                    })
                  }
                />
              )}
            </>
          ) : (
            <>
              <Text style={styles.body}>We sent a 6-digit code to {email.trim()}.</Text>
              <Field
                label="Code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={8}
                placeholder="123456"
              />
              <Button
                title="Verify"
                disabled={code.trim().length < 6}
                loading={busy}
                onPress={() =>
                  run(async () => {
                    await verifyEmailCode(supabase, email, code, mode);
                    done();
                  })
                }
              />
              <Button title="Use a different email" variant="ghost" onPress={() => setMode(null)} />
            </>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}
          <View style={{ flex: 1 }} />
          <Button title="Not now" variant="ghost" onPress={() => router.back()} />
          <Text style={styles.legal}>
            By continuing you agree to the Terms and confirm you are 18 or older.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: spacing.xl, gap: spacing.md },
  title: { ...typography.title, color: colors.text, marginTop: spacing.xl },
  body: { ...typography.body, color: colors.textMuted },
  or: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  error: { ...typography.body, color: colors.danger },
  legal: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
