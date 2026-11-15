import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field } from '@/components/ui';
import { EMPTY_FILTERS } from '@/features/map/filters';
import { useUserLocation } from '@/features/map/useUserLocation';
import { useVenueSearch } from '@/features/map/useVenueSearch';
import { categoryLabel, formatDistance } from '@/features/venues/format';
import { track } from '@/lib/analytics';
import { errorText } from '@/lib/errors';
import { ensureSession, supabase } from '@/lib/supabase';
import { colors, radii, spacing, typography } from '@/theme/tokens';

import { createSquad, squadLink } from './api';

/** Pick 2–3 venues, name the night, share the link. */
export function NewSquadScreen() {
  const params = useLocalSearchParams<{ venue?: string }>();
  const location = useUserLocation();
  const [query, setQuery] = useState('');
  const venues = useVenueSearch(location.ready ? location.center : null, {
    ...EMPTY_FILTERS,
    query,
  });
  const [picked, setPicked] = useState<string[]>(params.venue ? [params.venue] : []);
  const [title, setTitle] = useState('Where are we going tonight?');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]));

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await ensureSession();
      const code = await createSquad(supabase, picked, title);
      track('squad_created', { options: picked.length });
      await Share.share({ message: `${title} — vote here: ${squadLink(code)}` });
      router.replace(`/s/${code}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>New squad vote</Text>
        <Text style={styles.muted}>
          Pick 2 or 3 places. Friends vote from the link — no app needed.
        </Text>
        <Field label="Question" value={title} onChangeText={setTitle} maxLength={80} />
        <Field label="Find venues" value={query} onChangeText={setQuery} placeholder="Search" />
      </View>
      <FlatList
        data={venues.data ?? []}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        renderItem={({ item }) => {
          const on = picked.includes(item.id);
          return (
            <Pressable
              onPress={() => toggle(item.id)}
              style={[styles.row, on && styles.rowOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.muted}>
                  {categoryLabel(item.category)} · {formatDistance(item.distance_m)}
                  {(item.live_clip_count ?? 0) > 0 ? ` · ${item.live_clip_count} live` : ''}
                </Text>
              </View>
              <Text style={[styles.check, on && { color: colors.accent }]}>{on ? '●' : '○'}</Text>
            </Pressable>
          );
        }}
      />
      <View style={styles.footer}>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Button
          title={`Create & share (${picked.length}/3)`}
          disabled={picked.length < 2}
          loading={busy}
          onPress={create}
        />
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, gap: spacing.sm },
  title: { ...typography.title, color: colors.text },
  muted: { ...typography.caption, color: colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  name: { ...typography.heading, color: colors.text },
  check: { fontSize: 20, color: colors.textMuted },
  footer: { padding: spacing.lg, gap: spacing.xs },
  error: { ...typography.body, color: colors.danger, textAlign: 'center' },
});
