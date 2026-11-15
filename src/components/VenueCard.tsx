import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  categoryLabel,
  formatDistance,
  formatPriceBand,
  formatWalkTime,
  venueInitials,
} from '@/features/venues/format';
import type { NearbyVenue } from '@/features/venues/types';
import { colors, radii, spacing, typography } from '@/theme/tokens';

type Props = {
  venue: NearbyVenue;
  onClose: () => void;
  onOpen: () => void;
};

/** Card docked above the tab bar when a pin is selected. */
export function VenueCard({ venue, onClose, onOpen }: Props) {
  const meta = [
    categoryLabel(venue.category),
    formatDistance(venue.distance_m),
    formatWalkTime(venue.distance_m),
    formatPriceBand(venue.price_band),
  ].filter(Boolean);

  return (
    <View style={styles.card} testID="venue-card">
      {venue.cover_photo_url ? (
        <Image source={{ uri: venue.cover_photo_url }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Text style={styles.initials}>{venueInitials(venue.name)}</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {venue.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta.join(' · ')}
        </Text>
        {venue.music_tags.length > 0 && (
          <View style={styles.tags}>
            {venue.music_tags.slice(0, 3).map((tag) => (
              <Text key={tag} style={styles.tag}>
                {tag}
              </Text>
            ))}
          </View>
        )}
        <Text style={[styles.liveHint, (venue.live_clip_count ?? 0) > 0 && styles.liveOn]}>
          {(venue.live_clip_count ?? 0) > 0
            ? `● ${venue.live_clip_count} live ${venue.live_clip_count === 1 ? 'clip' : 'clips'} · Vibe ${venue.vibe_score ?? 0}`
            : 'No live clips in the last hour'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${venue.name}`}
          onPress={onOpen}
          style={styles.open}
          testID="venue-card-open"
        >
          <Text style={styles.openText}>See the vibe</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close venue card"
        onPress={onClose}
        hitSlop={12}
        style={styles.close}
      >
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  thumb: { width: 72, height: 88, borderRadius: radii.md },
  thumbFallback: {
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { ...typography.heading, color: colors.text },
  body: { flex: 1, justifyContent: 'center', gap: 4 },
  name: { ...typography.heading, color: colors.text, paddingRight: spacing.xl },
  meta: { ...typography.caption, color: colors.textMuted },
  tags: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  tag: {
    ...typography.caption,
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  liveHint: { ...typography.caption, color: colors.textMuted },
  liveOn: { color: colors.live },
  open: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginTop: 2,
  },
  openText: { ...typography.caption, color: '#fff', fontWeight: '700' },
  close: { position: 'absolute', top: spacing.sm, right: spacing.sm },
});
