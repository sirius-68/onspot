import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { categoryLabel } from '@/features/venues/format';
import { track } from '@/lib/analytics';
import { errorText } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing, typography } from '@/theme/tokens';

import {
  castVote,
  closesInText,
  fetchSquad,
  getGuestKey,
  getGuestName,
  leadingOption,
  setGuestName,
  squadLink,
  votePercent,
} from './api';

/** The vote page. Works in the app and on the web (guests vote with a name, no install). */
export function SquadVoteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();
  const [guestKey, setGuestKey] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [voting, setVoting] = useState<string | null>(null);
  const isGuest = !session;
  // Anyone without a profile (web guests, anonymous app users) adds a name to vote.
  const needsName = !profile;

  useEffect(() => {
    void getGuestKey().then(setGuestKey);
    void getGuestName().then(setName);
  }, []);

  const squad = useQuery({
    queryKey: ['squad', code, guestKey],
    queryFn: () => fetchSquad(supabase, code as string, isGuest ? guestKey : null),
    enabled: !!code && (!isGuest || !!guestKey),
    refetchInterval: 5_000,
  });

  async function vote(optionId: string) {
    setError(null);
    if (needsName && name.trim().length === 0) {
      setError('Add your name so friends know who voted.');
      return;
    }
    setVoting(optionId);
    try {
      if (needsName) await setGuestName(name);
      await castVote(
        supabase,
        code as string,
        optionId,
        needsName ? { key: guestKey as string, name } : null,
      );
      track('squad_voted');
      await queryClient.invalidateQueries({ queryKey: ['squad', code] });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setVoting(null);
    }
  }

  if (squad.isPending) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }
  if (!squad.data) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Text style={styles.title}>This vote doesn’t exist</Text>
        <Button title="Open Onspot" variant="secondary" onPress={() => router.replace('/')} />
      </SafeAreaView>
    );
  }

  const s = squad.data;
  const leader = leadingOption(s.options);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>
          {s.creator_username ? `@${s.creator_username} asks` : 'Squad vote'} ·{' '}
          {closesInText(s.closes_at)}
        </Text>
        <Text style={styles.title}>{s.title}</Text>
        <Text style={styles.muted}>
          {s.total_votes} {s.total_votes === 1 ? 'vote' : 'votes'}
          {leader ? ` · ${leader.name} is winning` : ''}
        </Text>

        {needsName && !s.closed && (
          <Field
            label="Your name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Marry"
            maxLength={40}
          />
        )}

        {s.options.map((o) => {
          const pct = votePercent(o.votes, s.total_votes);
          const mine = s.my_option_id === o.option_id;
          const winning = leader?.option_id === o.option_id;
          return (
            <Pressable
              key={o.option_id}
              disabled={s.closed || voting !== null}
              onPress={() => vote(o.option_id)}
              style={[styles.option, mine && styles.optionMine]}
              accessibilityRole="button"
              accessibilityLabel={`Vote for ${o.name}`}
            >
              <View style={[styles.bar, { width: `${pct}%` }, winning && styles.barWin]} />
              <View style={styles.optionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionName}>
                    {o.name} {mine ? '✓' : ''}
                  </Text>
                  <Text style={styles.muted}>
                    {categoryLabel(o.category as never)}
                    {o.voters.length > 0 ? ` · ${o.voters.slice(0, 4).join(', ')}` : ''}
                  </Text>
                </View>
                {voting === o.option_id ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Text style={styles.pct}>{pct}%</Text>
                )}
              </View>
              {!isGuest && (
                <Pressable onPress={() => router.push(`/venue/${o.venue_id}`)} hitSlop={6}>
                  <Text style={styles.link}>See the vibe →</Text>
                </Pressable>
              )}
            </Pressable>
          );
        })}

        {!!error && <Text style={styles.error}>{error}</Text>}
        {s.closed && leader && (
          <Text style={styles.winner}>Decided: {leader.name}. See you there!</Text>
        )}

        <Button
          title="Share vote link"
          variant="secondary"
          onPress={() => Share.share({ message: `${s.title} — vote here: ${squadLink(s.code)}` })}
        />
        {isGuest && (
          <View style={styles.cta}>
            <Ionicons name="phone-portrait-outline" size={18} color={colors.textMuted} />
            <Text style={styles.muted}>
              Get Onspot to see live clips from each venue before you vote.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: { ...typography.caption, color: colors.accent },
  title: { ...typography.title, color: colors.text },
  muted: { ...typography.caption, color: colors.textMuted },
  option: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    padding: spacing.md,
    gap: spacing.xs,
  },
  optionMine: { borderColor: colors.accent },
  bar: { ...StyleSheet.absoluteFill, right: undefined, backgroundColor: colors.surfaceRaised },
  barWin: { backgroundColor: colors.accentSoft },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  optionName: { ...typography.heading, color: colors.text },
  pct: { ...typography.heading, color: colors.text },
  link: { ...typography.caption, color: colors.accent },
  error: { ...typography.body, color: colors.danger },
  winner: { ...typography.heading, color: colors.live, textAlign: 'center' },
  cta: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center' },
});
