import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  categoryLabel,
  formatDistance,
  formatPriceBand,
  formatWalkTime,
} from '@/features/venues/format';
import type { NearbyVenue } from '@/features/venues/types';
import { track } from '@/lib/analytics';
import { openDirections } from '@/lib/directions';
import { colors, radii, shadow, spacing, typography } from '@/theme/tokens';

import { PhotoCard } from './PhotoCard';

type Props = {
  venue: NearbyVenue;
  width: number;
  onClose: () => void;
  onOpen: () => void;
};

const CAPACITY: Record<string, string> = { quiet: 'Quiet', busy: 'Busy', packed: 'Packed' };

/** One card in the swipeable row at the bottom of the map. */
export function VenueCard({ venue, width, onClose, onOpen }: Props) {
  const live = venue.live_clip_count ?? 0;
  const meta = [
    categoryLabel(venue.category),
    formatDistance(venue.distance_m),
    formatWalkTime(venue.distance_m),
    formatPriceBand(venue.price_band),
  ].filter(Boolean);

  return (
    <View style={[styles.card, { width }]} testID="venue-card">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${venue.name}`}
        onPress={onOpen}
      >
        <PhotoCard
          uri={venue.cover_photo_url}
          label={venue.name}
          width={96}
          height={116}
          radius={20}
        >
          {live > 0 && (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{live} live</Text>
            </View>
          )}
        </PhotoCard>
      </Pressable>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {venue.name}
          </Text>
          <Pressable accessibilityLabel="Close" onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {meta.join(' · ')}
        </Text>
        <View style={styles.stats}>
          <Text style={styles.vibe}>🔥 {venue.vibe_score ?? 0}</Text>
          {!!venue.capacity_level && (
            <Text style={styles.capacity}>{CAPACITY[venue.capacity_level]}</Text>
          )}
          {venue.music_tags.slice(0, 2).map((t) => (
            <Text key={t} style={styles.tag}>
              #{t}
            </Text>
          ))}
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Directions"
            onPress={() => {
              track('directions_opened', { venue_id: venue.id });
              void openDirections(venue.lat, venue.lng, venue.name);
            }}
            style={styles.dirBtn}
          >
            <Ionicons name="navigate" size={15} color={colors.blue} />
            <Text style={styles.dirText}>Go</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onOpen}
            style={styles.openBtn}
            testID="venue-card-open"
          >
            <Text style={styles.openText}>See the vibe</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.sm,
    ...shadow,
  },
  livePill: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.live },
  liveText: { fontSize: 11, fontWeight: '700', color: colors.white },
  body: { flex: 1, gap: 4, paddingVertical: spacing.xs, paddingRight: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { ...typography.heading, color: colors.text, flex: 1 },
  meta: { ...typography.caption, color: colors.textMuted },
  stats: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  vibe: { ...typography.caption, color: colors.accent, fontWeight: '700' },
  capacity: { ...typography.caption, color: colors.text },
  tag: { ...typography.caption, color: colors.blue },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: 'auto' },
  dirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.blueSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dirText: { ...typography.caption, color: colors.blue, fontWeight: '700' },
  openBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
  },
  openText: { ...typography.caption, color: colors.white, fontWeight: '700' },
});
