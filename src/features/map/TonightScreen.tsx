import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VenueCard } from '@/components/VenueCard';
import { missingEnv } from '@/lib/env';
import type { NearbyVenue } from '@/features/venues/types';
import { colors, radii, spacing, typography } from '@/theme/tokens';

import { TonightMap } from './TonightMap';
import { useNearbyVenues } from './useNearbyVenues';
import { useUserLocation } from './useUserLocation';

/** Tonight tab: the live venue map with a status pill and the selected venue's card. */
export function TonightScreen() {
  const insets = useSafeAreaInsets();
  const location = useUserLocation();
  const venuesQuery = useNearbyVenues(location.ready ? location.center : null);
  const [selected, setSelected] = useState<NearbyVenue | null>(null);

  const venues = venuesQuery.data ?? [];

  let status: string;
  if (missingEnv.length > 0) status = 'Setup needed: add keys to .env';
  else if (!location.ready || venuesQuery.isPending) status = 'Finding what’s on…';
  else if (venuesQuery.isError) status = 'Couldn’t load venues — tap to retry';
  else status = `${venues.length} ${venues.length === 1 ? 'venue' : 'venues'} near you tonight`;

  return (
    <View style={styles.screen}>
      <TonightMap
        center={location.center}
        showUserLocation={location.isUserPosition}
        venues={venues}
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
      />

      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <Text style={styles.title}>Tonight</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => venuesQuery.isError && venuesQuery.refetch()}
          style={styles.pill}
          testID="map-status"
        >
          {venuesQuery.isFetching && <ActivityIndicator size="small" color={colors.accent} />}
          <Text style={styles.pillText}>{status}</Text>
        </Pressable>
        {location.permission === 'denied' && (
          <Text style={styles.hint}>
            Location is off — showing the default area. Turn it on to see venues near you.
          </Text>
        )}
      </View>

      {selected && (
        <View style={styles.cardWrap}>
          <VenueCard venue={selected} onClose={() => setSelected(null)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  top: { position: 'absolute', left: spacing.lg, right: spacing.lg, gap: spacing.sm },
  title: {
    ...typography.title,
    color: colors.text,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pillText: { ...typography.caption, color: colors.text },
  hint: { ...typography.caption, color: colors.warning },
  cardWrap: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md },
});
