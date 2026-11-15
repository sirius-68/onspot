import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useIsFocused } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/ui';
import { VenueCard } from '@/components/VenueCard';
import { useRequireProfile } from '@/features/auth/useRequireProfile';
import { useFriendLocations, useShareLocationWhileOpen } from '@/features/friends/hooks';
import type { NearbyVenue } from '@/features/venues/types';
import { env } from '@/lib/env';
import { colors, radii, spacing, typography } from '@/theme/tokens';

import {
  CATEGORY_CHIPS,
  EMPTY_FILTERS,
  hasActiveFilters,
  toggleCategory,
  type VenueFilters,
} from './filters';
import { TonightMap } from './TonightMap';
import { useUserLocation } from './useUserLocation';
import { useVenueSearch } from './useVenueSearch';

/** Tonight tab: live venue map with search, filters, friends, and the selected venue's card. */
export function TonightScreen() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const location = useUserLocation();
  const [filters, setFilters] = useState<VenueFilters>(EMPTY_FILTERS);
  const venuesQuery = useVenueSearch(location.ready ? location.center : null, filters);
  const friends = useFriendLocations();
  const requireProfile = useRequireProfile();
  const [selected, setSelected] = useState<NearbyVenue | null>(null);
  useShareLocationWhileOpen(focused && location.isUserPosition);

  const venues = venuesQuery.data ?? [];
  const liveCount = venues.filter((v) => (v.live_clip_count ?? 0) > 0).length;

  let status: string;
  if (!location.ready || venuesQuery.isPending) status = 'Finding what’s on…';
  else if (venuesQuery.isError) status = 'Couldn’t load venues — tap to retry';
  else if (venues.length === 0)
    status = hasActiveFilters(filters) ? 'No venues match' : 'No venues near you yet';
  else
    status = `${venues.length} ${venues.length === 1 ? 'venue' : 'venues'}${
      liveCount > 0 ? ` · ${liveCount} live now` : ' near you tonight'
    }`;

  return (
    <View style={styles.screen}>
      <TonightMap
        center={location.center}
        showUserLocation={location.isUserPosition}
        venues={venues}
        friends={friends.data ?? []}
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
      />

      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={filters.query}
            onChangeText={(query) => setFilters((f) => ({ ...f, query }))}
            placeholder="Search night club, bar, afrobeats…"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            testID="map-search"
          />
          {hasActiveFilters(filters) && (
            <Pressable
              accessibilityLabel="Clear filters"
              onPress={() => setFilters(EMPTY_FILTERS)}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip
            label="Tonight"
            active={filters.tonightOnly}
            onPress={() => setFilters((f) => ({ ...f, tonightOnly: !f.tonightOnly }))}
          />
          <Chip
            label="££ or less"
            active={filters.maxPrice === 2}
            onPress={() => setFilters((f) => ({ ...f, maxPrice: f.maxPrice === 2 ? null : 2 }))}
          />
          {CATEGORY_CHIPS.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              active={filters.categories.includes(c.key)}
              onPress={() => setFilters((f) => toggleCategory(f, c.key))}
            />
          ))}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          onPress={() => venuesQuery.isError && venuesQuery.refetch()}
          style={styles.pill}
          testID="map-status"
        >
          {venuesQuery.isFetching && <ActivityIndicator size="small" color={colors.accent} />}
          <Text style={styles.pillText}>{status}</Text>
        </Pressable>
        {env.demoMode && (
          <Text style={styles.demo} testID="demo-banner">
            Demo mode · signed in as a guest, everything is saved on this phone only.
          </Text>
        )}
        {location.permission === 'denied' && (
          <Text style={styles.hint}>
            Location is off — showing the default area. Turn it on to see venues near you.
          </Text>
        )}
      </View>

      {selected ? (
        <View style={styles.cardWrap}>
          <VenueCard
            venue={selected}
            onClose={() => setSelected(null)}
            onOpen={() => router.push(`/venue/${selected.id}`)}
          />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Post a live clip"
          onPress={() => requireProfile() && router.push('/capture')}
          style={styles.fab}
          testID="capture-fab"
        >
          <Ionicons name="videocam" size={24} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  top: { position: 'absolute', left: spacing.md, right: spacing.md, gap: spacing.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.text, paddingVertical: spacing.sm + 2 },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
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
  demo: {
    ...typography.caption,
    color: colors.background,
    backgroundColor: colors.warning,
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  cardWrap: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
