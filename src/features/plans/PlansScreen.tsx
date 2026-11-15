import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { PhotoCard } from '@/components/PhotoCard';
import { useAuth } from '@/features/auth/AuthProvider';
import { useUserLocation } from '@/features/map/useUserLocation';
import { closesInText, fetchMySquads } from '@/features/squads/api';
import { eventTimeText } from '@/features/venues/eventFormat';
import { formatDistance } from '@/features/venues/format';
import { openDirections } from '@/lib/directions';
import { errorText } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { openTicketLink } from '@/lib/tickets';
import { colors, radii, shadow, spacing, typography } from '@/theme/tokens';

import { fetchEventsTonight, type TonightEvent } from './api';

type Segment = 'tonight' | 'squads';

/** Plans tab: what's on tonight near you (tickets, spots left) and your squad votes. */
export function PlansScreen() {
  const [segment, setSegment] = useState<Segment>('tonight');
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader title="Plans" />
      <View style={styles.segments}>
        {(
          [
            ['tonight', 'Tonight'],
            ['squads', 'Squads'],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: segment === key }}
            onPress={() => setSegment(key)}
            style={[styles.segment, segment === key && styles.segmentOn]}
            testID={`plans-${key}`}
          >
            <Text style={[styles.segmentText, segment === key && styles.segmentTextOn]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {segment === 'tonight' ? <TonightEvents /> : <Squads />}
    </SafeAreaView>
  );
}

function TonightEvents() {
  const location = useUserLocation();
  const events = useQuery({
    queryKey: ['events-tonight', location.center.lat.toFixed(3), location.center.lng.toFixed(3)],
    queryFn: () => fetchEventsTonight(supabase, location.center),
    enabled: location.ready,
    refetchInterval: 120_000,
  });
  return (
    <FlatList
      data={events.data ?? []}
      keyExtractor={(e) => e.event_id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        events.isPending ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
        ) : (
          <Text style={styles.empty}>
            {events.isError ? errorText(events.error) : 'No events listed near you tonight.'}
          </Text>
        )
      }
      renderItem={({ item }) => <EventCard event={item} />}
    />
  );
}

/** Compact spots label for the event cards: "40 left", "12 left!", "Sold out". */
export function shortSpots(n: number | null): string | null {
  if (n === null) return null;
  if (n === 0) return 'Sold out';
  return n <= 15 ? `${n} left!` : `${n} left`;
}

function EventCard({ event: e }: { event: TonightEvent }) {
  const spots = shortSpots(e.spots_left);
  const soldOut = e.spots_left === 0;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/venue/${e.venue_id}`)}
      style={styles.card}
      testID="event-card"
    >
      <PhotoCard uri={e.cover_photo_url} label={e.venue_name} width={92} height={112} />
      <View style={styles.cardBody}>
        <Text style={styles.eventTitle} numberOfLines={1}>
          {e.title}
        </Text>
        <Text style={styles.muted} numberOfLines={1}>
          {e.venue_name} · {formatDistance(e.distance_m)}
        </Text>
        <Text style={styles.muted} numberOfLines={1}>
          {[eventTimeText(e), e.price_text].filter(Boolean).join(' · ')}
        </Text>
        <View style={styles.cardActions}>
          {!!spots && (
            <Text style={[styles.spots, soldOut && styles.soldOut]} numberOfLines={1}>
              {spots}
            </Text>
          )}
          <View style={{ flex: 1 }} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Directions"
            onPress={() => void openDirections(e.lat, e.lng, e.venue_name)}
            style={styles.iconBtn}
            hitSlop={6}
          >
            <Ionicons name="navigate" size={16} color={colors.blue} />
          </Pressable>
          {!!e.ticket_url && !soldOut && (
            <Pressable
              accessibilityRole="button"
              onPress={() => openTicketLink(e.ticket_url as string, e.venue_id)}
              style={styles.ticketBtn}
            >
              <Text style={styles.ticketText}>Tickets</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function Squads() {
  const { session } = useAuth();
  const squads = useQuery({
    queryKey: ['my-squads'],
    queryFn: () => fetchMySquads(supabase),
    enabled: !!session,
    refetchInterval: 30_000,
  });
  return (
    <FlatList
      data={squads.data ?? []}
      keyExtractor={(s) => s.code}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/squad/new')}
          style={styles.newSquad}
          testID="squad-new"
        >
          <View style={styles.newIcon}>
            <Ionicons name="people" size={20} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eventTitle}>Start a squad vote</Text>
            <Text style={styles.muted}>Can’t agree where to go? Put 2–3 places to a vote.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      }
      ListEmptyComponent={<Text style={styles.empty}>No votes yet.</Text>}
      renderItem={({ item }) => (
        <Pressable style={styles.squad} onPress={() => router.push(`/s/${item.code}`)}>
          <Text style={styles.eventTitle}>{item.title}</Text>
          <Text style={styles.muted}>
            {item.total_votes} {Number(item.total_votes) === 1 ? 'vote' : 'votes'} ·{' '}
            {closesInText(item.closes_at)}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  segments: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    padding: 4,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radii.pill },
  segmentOn: { backgroundColor: colors.white, ...shadow, shadowOpacity: 0.08 },
  segmentText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  segmentTextOn: { color: colors.text },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardBody: { flex: 1, gap: 3, paddingVertical: spacing.xs, paddingRight: spacing.xs },
  eventTitle: { ...typography.heading, color: colors.text },
  muted: { ...typography.caption, color: colors.textMuted },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 'auto' },
  spots: {
    ...typography.caption,
    flexShrink: 1,
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    overflow: 'hidden',
    fontWeight: '700',
  },
  soldOut: { color: colors.danger, backgroundColor: 'rgba(239,68,68,0.1)' },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketBtn: {
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  ticketText: { ...typography.caption, color: colors.white, fontWeight: '700' },
  newSquad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  newIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squad: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    gap: 2,
  },
});
