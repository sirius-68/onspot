import { router } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Button, SectionTitle } from '@/components/ui';
import { track } from '@/lib/analytics';
import { openDirections } from '@/lib/directions';
import { colors, radii, spacing, typography } from '@/theme/tokens';

import { capacityText, eventTimeText, queueText, spotsText, vibeText } from './eventFormat';
import type { VenueDetail } from './useVenue';

/** Status, tonight's events with tickets, directions and squad actions. */
export function VenueDetails({ venue }: { venue: VenueDetail }) {
  const status = [
    capacityText(venue.status?.capacity_level),
    queueText(venue.status?.queue_minutes),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.wrap}>
      <View style={styles.vibe}>
        <Text style={styles.vibeScore}>{venue.vibe_score}</Text>
        <View>
          <Text style={styles.vibeLabel}>Vibe Score</Text>
          <Text style={styles.vibeText}>{vibeText(venue.vibe_score)}</Text>
        </View>
        {!!status && <Text style={styles.status}>{status}</Text>}
      </View>

      {venue.music_tags.length > 0 && (
        <Text style={styles.tags}>{venue.music_tags.map((t) => '#' + t).join('  ')}</Text>
      )}

      <SectionTitle>Tonight</SectionTitle>
      {venue.events.length === 0 && <Text style={styles.muted}>No events listed for tonight.</Text>}
      {venue.events.map((e) => {
        const spots = spotsText(e.spots_left);
        return (
          <View key={e.id} style={styles.event}>
            <Text style={styles.eventTitle}>{e.title}</Text>
            <Text style={styles.muted}>
              {[eventTimeText(e), e.price_text].filter(Boolean).join(' · ')}
            </Text>
            {!!spots && (
              <Text style={[styles.spots, e.spots_left === 0 && { color: colors.danger }]}>
                {spots}
              </Text>
            )}
            {!!e.ticket_url && e.spots_left !== 0 && (
              <Button
                title="Get tickets"
                onPress={() => {
                  track('ticket_link_opened', { venue_id: venue.id });
                  void Linking.openURL(e.ticket_url as string);
                }}
              />
            )}
          </View>
        );
      })}

      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Button
            title="Directions"
            variant="secondary"
            onPress={() => {
              track('directions_opened', { venue_id: venue.id });
              void openDirections(venue.lat, venue.lng, venue.name);
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Ask the squad"
            variant="secondary"
            onPress={() => router.push({ pathname: '/squad/new', params: { venue: venue.id } })}
          />
        </View>
      </View>
      {venue.is_host && (
        <Button title="Manage this venue" variant="ghost" onPress={() => router.push('/host')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: spacing.sm },
  vibe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  vibeScore: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.accent,
    minWidth: 52,
    textAlign: 'center',
  },
  vibeLabel: { ...typography.caption, color: colors.textMuted },
  vibeText: { ...typography.heading, color: colors.text },
  status: { ...typography.caption, color: colors.warning, marginLeft: 'auto' },
  tags: { ...typography.caption, color: colors.accent },
  muted: { ...typography.caption, color: colors.textMuted },
  event: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  eventTitle: { ...typography.heading, color: colors.text },
  spots: { ...typography.caption, color: colors.warning, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
