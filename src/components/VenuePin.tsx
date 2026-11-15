import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { venueInitials } from '@/features/venues/format';
import type { NearbyVenue } from '@/features/venues/types';
import { colors, radii, typography } from '@/theme/tokens';

type Props = {
  venue: NearbyVenue;
  selected?: boolean;
  onPress?: (venue: NearbyVenue) => void;
};

/** Round photo pin with the venue name underneath (Snapchat/Hypelist-style map pin). */
export function VenuePin({ venue, selected = false, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${venue.name}, open venue`}
      onPress={() => onPress?.(venue)}
      style={styles.wrap}
      hitSlop={8}
    >
      <View
        style={[
          styles.ring,
          (venue.live_clip_count ?? 0) > 0 && styles.ringLive,
          selected && styles.ringSelected,
        ]}
      >
        {venue.cover_photo_url ? (
          <Image source={{ uri: venue.cover_photo_url }} style={styles.photo} contentFit="cover" />
        ) : (
          <View style={[styles.photo, styles.fallback]}>
            <Text style={styles.initials}>{venueInitials(venue.name)}</Text>
          </View>
        )}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {venue.name}
      </Text>
    </Pressable>
  );
}

const SIZE = 44;

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', maxWidth: 110 },
  ring: {
    padding: 2,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.surfaceRaised,
    backgroundColor: colors.surface,
  },
  ringLive: { borderColor: colors.live },
  ringSelected: { borderColor: colors.accent },
  photo: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  fallback: {
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { ...typography.caption, color: colors.text, fontWeight: '700' },
  label: {
    ...typography.caption,
    color: colors.text,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowRadius: 3,
  },
});
