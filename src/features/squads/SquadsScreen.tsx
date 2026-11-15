import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing, typography } from '@/theme/tokens';

import { closesInText, fetchMySquads } from './api';

/** Squads tab: votes you started or joined. */
export function SquadsScreen() {
  const { session } = useAuth();
  const squads = useQuery({
    queryKey: ['my-squads'],
    queryFn: () => fetchMySquads(supabase),
    enabled: !!session,
    refetchInterval: 30_000,
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Squads</Text>
        <Text style={styles.muted}>Can’t agree where to go? Put 2–3 places to a vote.</Text>
        <Button title="Start a squad vote" onPress={() => router.push('/squad/new')} />
      </View>
      <FlatList
        data={squads.data ?? []}
        keyExtractor={(s) => s.code}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ListEmptyComponent={
          <Text style={[styles.muted, { textAlign: 'center' }]}>
            {session ? 'No votes yet.' : 'Your votes will show here.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/s/${item.code}`)}>
            <Text style={styles.name}>{item.title}</Text>
            <Text style={styles.muted}>
              {item.total_votes} {Number(item.total_votes) === 1 ? 'vote' : 'votes'} ·{' '}
              {closesInText(item.closes_at)}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, gap: spacing.sm },
  title: { ...typography.title, color: colors.text },
  muted: { ...typography.caption, color: colors.textMuted },
  row: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 2,
  },
  name: { ...typography.heading, color: colors.text },
});
