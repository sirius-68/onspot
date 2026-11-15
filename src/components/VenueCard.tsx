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
};

/** Card docked above the tab bar when a pin is selected. */
export function VenueCard({ venue, onClose }: Props) {
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
        <Text style={styles.liveHint}>No live clips yet tonight</Text>
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
  liveHint: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
  close: { position: 'absolute', top: spacing.sm, right: spacing.sm },
});
