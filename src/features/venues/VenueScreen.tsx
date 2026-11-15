import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClipCarousel } from '@/components/ClipCarousel';
import { useLiveClips } from '@/features/clips/useLiveClips';
import { useRequireProfile } from '@/features/auth/useRequireProfile';
import { useReportClip } from '@/features/safety/useReport';
import { track } from '@/lib/analytics';
import { colors, radii, spacing, typography } from '@/theme/tokens';

import { categoryLabel, formatPriceBand } from './format';
import { VenueDetails } from './VenueDetails';
import { useVenue } from './useVenue';

/** Venue page: live clips first, then what's on tonight and how to get in. */
export function VenueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const venue = useVenue(id ?? null);
  const clips = useLiveClips(id ?? null);
  const reportClip = useReportClip();
  const requireProfile = useRequireProfile();

  useEffect(() => {
    if (id) track('venue_viewed', { venue_id: id });
  }, [id]);

  if (venue.isPending) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (venue.isError || !venue.data) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.body}>Couldn’t load this venue.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const v = venue.data;
  const meta = [categoryLabel(v.category), formatPriceBand(v.price_band), v.address]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
        <View>
          <ClipCarousel
            clips={clips.data ?? []}
            height={460}
            onReport={reportClip}
            fallbackImage={venue.data.cover_photo_url}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post a live clip here"
            onPress={() => requireProfile() && router.push('/capture')}
            style={styles.fab}
          >
            <Ionicons name="videocam" size={18} color={colors.white} />
            <Text style={styles.fabText}>Show the vibe</Text>
          </Pressable>
        </View>
        <View style={styles.content}>
          <Text style={styles.name}>{v.name}</Text>
          {!!meta && <Text style={styles.meta}>{meta}</Text>}
          <Text style={styles.liveCount}>
            {(clips.data?.length ?? 0) === 0
              ? 'No live clips right now'
              : `${clips.data?.length} live ${clips.data?.length === 1 ? 'clip' : 'clips'} in the last hour`}
          </Text>
          <VenueDetails venue={v} />
        </View>
      </ScrollView>

      <Pressable
        accessibilityLabel="Back"
        onPress={() => router.back()}
        style={[styles.back, { top: insets.top + spacing.sm }]}
        hitSlop={10}
      >
        <Ionicons name="chevron-back" size={22} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  content: { padding: spacing.lg, gap: spacing.sm },
  name: { ...typography.title, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted },
  liveCount: { ...typography.caption, color: colors.live },
  body: { ...typography.body, color: colors.textMuted },
  link: { ...typography.body, color: colors.accent },
  back: {
    position: 'absolute',
    left: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radii.pill,
    padding: spacing.sm,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    top: 460 - 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  fabText: { ...typography.heading, color: colors.white },
});
