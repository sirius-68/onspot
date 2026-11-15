import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { NearbyVenue } from '@/features/venues/types';
import { colors, shadow } from '@/theme/tokens';

import { Avatar } from './Avatar';
import { PhotoCard } from './PhotoCard';

type Props = {
  venue: NearbyVenue;
  selected?: boolean;
  onPress?: (venue: NearbyVenue) => void;
};

/** A stable tilt between -7° and 7° per venue, so cards look casually pinned. */
export function tiltFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 15) - 7;
}

const W = 84;
const H = 100;

/**
 * Map pin from the references: a tilted photo card with a white border, the avatar of the
 * friend who posted there, and a blue dot marking the exact spot.
 */
export function VenuePin({ venue, selected = false, onPress }: Props) {
  const live = venue.live_clip_count ?? 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${venue.name}, open venue`}
      onPress={() => onPress?.(venue)}
      style={[styles.wrap, selected && styles.selected]}
      hitSlop={6}
    >
      <View style={{ transform: [{ rotate: `${tiltFor(venue.id)}deg` }] }}>
        <PhotoCard
          uri={venue.cover_photo_url}
          label={venue.name}
          width={W}
          height={H}
          radius={20}
          border={selected ? 4 : 3}
          style={selected ? styles.cardSelected : undefined}
        />
        {venue.badge_avatar_url || venue.badge_name ? (
          <Avatar
            name={venue.badge_name ?? venue.name}
            url={venue.badge_avatar_url}
            size={30}
            ring
            style={styles.badge}
          />
        ) : live > 0 ? (
          <View style={[styles.badge, styles.live]}>
            <Text style={styles.liveText}>{live}</Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.pin, selected && { backgroundColor: colors.accent }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 10, paddingHorizontal: 10 },
  selected: { transform: [{ scale: 1.12 }] },
  cardSelected: { borderColor: colors.white, shadowOpacity: 0.3 },
  badge: { position: 'absolute', top: -9, left: -9 },
  live: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.live,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveText: { fontSize: 11, fontWeight: '800', color: colors.white },
  pin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.blue,
    borderWidth: 3,
    borderColor: colors.white,
    marginTop: -6,
    ...shadow,
  },
});
