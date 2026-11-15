import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, spacing, typography } from '@/theme/tokens';

import { saveProfile } from './api';
import { useAuth } from './AuthProvider';
import {
  isAdult,
  isValidUsername,
  normalizeUsername,
  parseBirthdate,
  toIsoDate,
} from './validation';

/** Username + date of birth (18+). Existing users skip straight back. */
export function OnboardingScreen() {
  const { profile, loading, hasAccount, refetchProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [birth, setBirth] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && profile) router.replace('/');
  }, [loading, profile]);

  const birthdate = parseBirthdate(birth);
  const birthError =
    birth.length >= 8 && !birthdate
      ? 'Use DD/MM/YYYY'
      : birthdate && !isAdult(birthdate)
        ? 'Onspot is for people aged 18 and over.'
        : null;
  const usernameError =
    username.length > 0 && !isValidUsername(username)
      ? '3–20 letters, numbers or underscores'
      : null;
  const canSave = isValidUsername(username) && !!birthdate && isAdult(birthdate);

  async function save() {
    if (!birthdate) return;
    setBusy(true);
    setError(null);
    try {
      await saveProfile(supabase, normalizeUsername(username), displayName, toIsoDate(birthdate));
      await refetchProfile();
      router.replace('/');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (!hasAccount && !loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Sign in first</Text>
          <Button title="Sign in" onPress={() => router.replace('/sign-in')} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Set up your profile</Text>
        <Text style={styles.body}>
          Friends find you by username. Your date of birth is never shown.
        </Text>
        <Field
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="marry_out"
          error={usernameError}
        />
        <Field
          label="Name (optional)"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Marry"
        />
        <Field
          label="Date of birth"
          value={birth}
          onChangeText={setBirth}
          keyboardType="numbers-and-punctuation"
          placeholder="DD/MM/YYYY"
          error={birthError}
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Button title="Save" disabled={!canSave} loading={busy} onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.md },
  title: { ...typography.title, color: colors.text, marginTop: spacing.xl },
  body: { ...typography.body, color: colors.textMuted },
  error: { ...typography.body, color: colors.danger },
});
