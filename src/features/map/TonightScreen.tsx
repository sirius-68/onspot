import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { Chip } from '@/components/ui';
import { VenueCard } from '@/components/VenueCard';
import { useAuth } from '@/features/auth/AuthProvider';
import { useFriendLocations, useShareLocationWhileOpen } from '@/features/friends/hooks';
import type { NearbyVenue } from '@/features/venues/types';
import { env } from '@/lib/env';
import { colors, radii, shadow, spacing, typography } from '@/theme/tokens';

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

const CARD_GAP = spacing.md;

/**
 * Map tab: venue photo cards on the map, friends' bubbles, search at the bottom, and a row of
 * venue cards you swipe left/right through (the map follows).
 */
export function TonightScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const focused = useIsFocused();
  const { profile } = useAuth();
  const location = useUserLocation();
  const [filters, setFilters] = useState<VenueFilters>(EMPTY_FILTERS);
  const venuesQuery = useVenueSearch(location.ready ? location.center : null, filters);
  const friends = useFriendLocations();
  const [selected, setSelected] = useState<NearbyVenue | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const listRef = useRef<FlatList<NearbyVenue>>(null);
  useShareLocationWhileOpen(focused && location.isUserPosition);

  const venues = useMemo(() => venuesQuery.data ?? [], [venuesQuery.data]);
  const liveCount = venues.filter((v) => (v.live_clip_count ?? 0) > 0).length;
  const cardWidth = width - spacing.xl * 2;
  const selectedIndex = selected ? venues.findIndex((v) => v.id === selected.id) : -1;

  // Keep the card row on the venue picked on the map.
  useEffect(() => {
    if (selectedIndex >= 0) {
      listRef.current?.scrollToIndex({ index: selectedIndex, animated: true });
    }
  }, [selectedIndex]);

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
        focus={selected ? { lat: selected.lat, lng: selected.lng } : null}
        me={
          profile
            ? { name: profile.display_name ?? profile.username, avatarUrl: profile.avatar_url }
            : null
        }
        recenterKey={recenterKey}
      />

      <LinearGradient
        colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0)']}
        style={[styles.topFade, { paddingTop: insets.top }]}
        pointerEvents="box-none"
      >
        <AppHeader />
        <Pressable
          accessibilityRole="button"
          onPress={() => venuesQuery.isError && venuesQuery.refetch()}
          style={styles.status}
          testID="map-status"
        >
          {venuesQuery.isFetching && <ActivityIndicator size="small" color={colors.blue} />}
          <Text style={styles.statusText}>{status}</Text>
        </Pressable>
        {env.demoMode && (
          <Text style={styles.demo} testID="demo-banner">
            Demo mode · saved on this phone only
          </Text>
        )}
        {location.permission === 'denied' && (
          <Text style={styles.hint}>Location is off — showing the default area.</Text>
        )}
      </LinearGradient>

      <View style={styles.bottom} pointerEvents="box-none">
        {selected ? (
          <FlatList
            ref={listRef}
            data={venues}
            horizontal
            keyExtractor={(v) => v.id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardWidth + CARD_GAP}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: CARD_GAP }}
            getItemLayout={(_, index) => ({
              length: cardWidth + CARD_GAP,
              offset: (cardWidth + CARD_GAP) * index,
              index,
            })}
            initialScrollIndex={Math.max(selectedIndex, 0)}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + CARD_GAP));
              const v = venues[i];
              if (v && v.id !== selected.id) setSelected(v);
            }}
            renderItem={({ item }) => (
              <VenueCard
                venue={item}
                width={cardWidth}
                onClose={() => setSelected(null)}
                onOpen={() => router.push(`/venue/${item.id}`)}
              />
            )}
          />
        ) : (
          <>
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
            <View style={styles.searchRow}>
              <View style={styles.search}>
                <Ionicons name="location-outline" size={18} color={colors.textMuted} />
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Centre on me"
                onPress={() => setRecenterKey((k) => k + 1)}
                style={styles.locate}
                testID="map-locate"
              >
                <Ionicons name="compass-outline" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: spacing.xl,
    alignItems: 'stretch',
    gap: spacing.xs,
  },
  status: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    ...shadow,
    shadowOpacity: 0.08,
  },
  statusText: { ...typography.caption, color: colors.text },
  demo: {
    ...typography.caption,
    alignSelf: 'center',
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  hint: { ...typography.caption, color: colors.warning, alignSelf: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: spacing.lg, gap: spacing.sm },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    ...shadow,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.text, paddingVertical: spacing.md },
  locate: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
});
