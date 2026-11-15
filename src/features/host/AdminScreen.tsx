import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Chip, Field, SectionTitle } from '@/components/ui';
import { EMPTY_FILTERS } from '@/features/map/filters';
import { useUserLocation } from '@/features/map/useUserLocation';
import { useVenueSearch } from '@/features/map/useVenueSearch';
import { errorText, unwrap } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing, typography } from '@/theme/tokens';

const METRIC_LABELS: Record<string, string> = {
  venues: 'Venues',
  venues_fresh_30m: 'Venues with a clip < 30 min',
  live_clips_60m: 'Live clips (60 min)',
  organic_share_24h: 'Organic clip share (24 h)',
  squads_24h: 'Squads (24 h)',
  squad_rate_24h: 'Squads with 2+ votes',
  open_reports: 'Open reports',
};

/** Owner tools: tonight's metrics, make Spotters, assign venue hosts. */
export function AdminScreen() {
  const metrics = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: async () =>
      unwrap(await supabase.rpc('admin_metrics')) as Record<string, number | string | null>,
    refetchInterval: 60_000,
  });
  const location = useUserLocation();
  const [venueQuery, setVenueQuery] = useState('');
  const venues = useVenueSearch(location.ready ? location.center : null, {
    ...EMPTY_FILTERS,
    query: venueQuery,
  });
  const [venueId, setVenueId] = useState<string | null>(null);
  const [username, setUsername] = useState('');

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      Alert.alert('Done', ok);
    } catch (e) {
      Alert.alert('Failed', errorText(e));
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Admin</Text>
        <SectionTitle>Tonight</SectionTitle>
        {metrics.isError && <Text style={styles.error}>{errorText(metrics.error)}</Text>}
        <View style={styles.grid}>
          {Object.entries(METRIC_LABELS).map(([key, label]) => (
            <View key={key} style={styles.metric}>
              <Text style={styles.value}>{String(metrics.data?.[key] ?? '–')}</Text>
              <Text style={styles.muted}>{label}</Text>
            </View>
          ))}
        </View>

        <SectionTitle>People</SectionTitle>
        <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
        <View style={styles.wrap}>
          <Button
            title="Make Spotter"
            variant="secondary"
            onPress={() =>
              run(
                async () =>
                  unwrap(
                    await supabase.rpc('admin_set_role', {
                      p_username: username,
                      p_role: 'spotter',
                    }),
                  ),
                'Role updated.',
              )
            }
          />
          <Button
            title="Make regular user"
            variant="secondary"
            onPress={() =>
              run(
                async () =>
                  unwrap(
                    await supabase.rpc('admin_set_role', { p_username: username, p_role: 'user' }),
                  ),
                'Role updated.',
              )
            }
          />
        </View>

        <SectionTitle>Assign a venue host</SectionTitle>
        <Field label="Find venue" value={venueQuery} onChangeText={setVenueQuery} />
        <View style={styles.wrap}>
          {(venues.data ?? []).slice(0, 8).map((v) => (
            <Chip
              key={v.id}
              label={v.name}
              active={venueId === v.id}
              onPress={() => setVenueId(v.id)}
            />
          ))}
        </View>
        <Button
          title="Make this user a host of the venue"
          disabled={!venueId || username.trim().length < 3}
          onPress={() =>
            run(
              async () =>
                unwrap(
                  await supabase.rpc('admin_assign_host', {
                    p_venue_id: venueId,
                    p_username: username,
                  }),
                ),
              'Host assigned.',
            )
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.title, color: colors.text },
  muted: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.caption, color: colors.danger },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  value: { fontSize: 22, fontWeight: '800', color: colors.accent },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
