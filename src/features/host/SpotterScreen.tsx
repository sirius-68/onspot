import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { useUserLocation } from '@/features/map/useUserLocation';
import { formatDistance } from '@/features/venues/format';
import { errorText, unwrap } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing, typography } from '@/theme/tokens';

type Task = {
  venue_id: string;
  name: string;
  distance_m: number;
  minutes_since_clip: number | null;
};
type Stats = { clips_last_12h: number; clips_last_7d: number; venues_last_12h: number };

/** Spotter mode: venues that need a fresh clip, and your verified-clip counts for payouts. */
export function SpotterScreen() {
  const location = useUserLocation();
  const stats = useQuery({
    queryKey: ['spotter-stats'],
    queryFn: async () =>
      ((unwrap(await supabase.rpc('spotter_stats')) as Stats[] | null) ?? [])[0] ?? null,
    refetchInterval: 60_000,
  });
  const tasks = useQuery({
    queryKey: ['spotter-tasks', location.center.lat, location.center.lng],
    queryFn: async () =>
      (unwrap(
        await supabase.rpc('spotter_tasks', {
          origin_lat: location.center.lat,
          origin_lng: location.center.lng,
          radius_m: 3000,
        }),
      ) as Task[] | null) ?? [],
    enabled: location.ready,
    refetchInterval: 60_000,
  });

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Spotter mode</Text>
        <View style={styles.stats}>
          <Stat label="Clips (12 h)" value={stats.data?.clips_last_12h ?? 0} />
          <Stat label="Venues (12 h)" value={stats.data?.venues_last_12h ?? 0} />
          <Stat label="Clips (7 days)" value={stats.data?.clips_last_7d ?? 0} />
        </View>
        <Text style={styles.muted}>
          These venues have no live clip in the last 30 minutes. Only clips shot inside the venue
          count.
        </Text>
        {tasks.isError && <Text style={styles.error}>{errorText(tasks.error)}</Text>}
      </View>
      <FlatList
        data={tasks.data ?? []}
        keyExtractor={(t) => t.venue_id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ListEmptyComponent={
          <Text style={styles.muted}>All nearby venues are fresh. Nice work.</Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/venue/${item.venue_id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.muted}>
                {formatDistance(item.distance_m)} ·{' '}
                {item.minutes_since_clip == null
                  ? 'no clips tonight'
                  : `last clip ${item.minutes_since_clip} min ago`}
              </Text>
            </View>
            <Button title="Shoot" onPress={() => router.push('/capture')} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, gap: spacing.md },
  title: { ...typography.title, color: colors.text },
  muted: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.caption, color: colors.danger },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.accent },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  name: { ...typography.heading, color: colors.text },
});
