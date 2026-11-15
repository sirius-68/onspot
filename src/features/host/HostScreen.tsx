import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Chip, Field, SectionTitle } from '@/components/ui';
import type { CapacityLevel } from '@/features/venues/useVenue';
import { errorText, unwrap } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, spacing, typography } from '@/theme/tokens';

import { buildEventTimes, isValidTicketUrl } from './eventForm';

type Hosted = { venue_id: string; name: string };

const LEVELS: { key: CapacityLevel; label: string }[] = [
  { key: 'quiet', label: 'Quiet' },
  { key: 'busy', label: 'Busy' },
  { key: 'packed', label: 'Packed' },
];
const QUEUES = [0, 5, 15, 30, 60];

/** Host Live: door status, official clips and tonight's events for venues you run. */
export function HostScreen() {
  const queryClient = useQueryClient();
  const venues = useQuery({
    queryKey: ['hosted-venues'],
    queryFn: async () => (unwrap(await supabase.rpc('my_hosted_venues')) as Hosted[] | null) ?? [],
  });
  const [venueId, setVenueId] = useState<string | null>(null);
  const current = venueId ?? venues.data?.[0]?.venue_id ?? null;
  const [level, setLevel] = useState<CapacityLevel>('busy');
  const [queue, setQueue] = useState<number>(0);

  const [title, setTitle] = useState('');
  const [start, setStart] = useState('22:00');
  const [end, setEnd] = useState('03:00');
  const [price, setPrice] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [spots, setSpots] = useState('');
  const [saving, setSaving] = useState(false);

  async function run(fn: () => Promise<unknown>, done: string) {
    setSaving(true);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: ['venue', current] });
      Alert.alert('Saved', done);
    } catch (e) {
      Alert.alert('Couldn’t save', errorText(e));
    } finally {
      setSaving(false);
    }
  }

  if (!venues.isPending && (venues.data?.length ?? 0) === 0) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <Text style={styles.title}>Host mode</Text>
          <Text style={styles.muted}>
            You’re not a host for any venue yet. Venue owners: contact Onspot to claim your venue.
          </Text>
          <Button title="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const times = buildEventTimes(start, end);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Host mode</Text>
        <View style={styles.wrap}>
          {(venues.data ?? []).map((v) => (
            <Chip
              key={v.venue_id}
              label={v.name}
              active={v.venue_id === current}
              onPress={() => setVenueId(v.venue_id)}
            />
          ))}
        </View>

        <SectionTitle>Door right now</SectionTitle>
        <View style={styles.wrap}>
          {LEVELS.map((l) => (
            <Chip
              key={l.key}
              label={l.label}
              active={level === l.key}
              onPress={() => setLevel(l.key)}
            />
          ))}
        </View>
        <Text style={styles.muted}>Queue</Text>
        <View style={styles.wrap}>
          {QUEUES.map((q) => (
            <Chip
              key={q}
              label={q === 0 ? 'None' : `${q} min`}
              active={queue === q}
              onPress={() => setQueue(q)}
            />
          ))}
        </View>
        <Button
          title="Update status"
          loading={saving}
          disabled={!current}
          onPress={() =>
            run(
              async () =>
                unwrap(
                  await supabase.rpc('set_venue_status', {
                    p_venue_id: current,
                    p_capacity_level: level,
                    p_queue_minutes: queue,
                  }),
                ),
              'Door status updated. It shows on your venue for 3 hours.',
            )
          }
        />
        <Button
          title="Post an official clip"
          variant="secondary"
          onPress={() => router.push('/capture')}
        />

        <SectionTitle>Add tonight’s event</SectionTitle>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Afro Fridays" />
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Field label="Starts (HH:MM)" value={start} onChangeText={setStart} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Ends (HH:MM)" value={end} onChangeText={setEnd} />
          </View>
        </View>
        <Field
          label="Price (optional)"
          value={price}
          onChangeText={setPrice}
          placeholder="£10 before 11"
        />
        <Field
          label="Ticket link (optional, https)"
          value={ticketUrl}
          onChangeText={setTicketUrl}
          autoCapitalize="none"
          error={ticketUrl && !isValidTicketUrl(ticketUrl) ? 'Must start with https://' : null}
        />
        <Field
          label="Spots left (optional)"
          value={spots}
          onChangeText={setSpots}
          keyboardType="number-pad"
        />
        <Button
          title="Publish event"
          loading={saving}
          disabled={
            !current ||
            title.trim() === '' ||
            !times ||
            (!!ticketUrl && !isValidTicketUrl(ticketUrl))
          }
          onPress={() =>
            run(
              async () =>
                unwrap(
                  await supabase.rpc('host_upsert_event', {
                    p_venue_id: current,
                    p_title: title.trim(),
                    p_starts_at: times?.startsAt,
                    p_ends_at: times?.endsAt,
                    p_price_text: price.trim() || null,
                    p_ticket_url: ticketUrl.trim() || null,
                    p_spots_left: spots ? Number(spots) : null,
                  }),
                ),
              'Event published.',
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
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row2: { flexDirection: 'row', gap: spacing.sm },
});
