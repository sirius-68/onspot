import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { clipPublicUrl } from '@/features/clips/api';
import { formatFreshness } from '@/features/clips/format';
import type { LiveClip } from '@/features/clips/types';
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing, typography } from '@/theme/tokens';

import { ClipMedia } from './ClipPlayer';

type ViewToken = { index?: number | null; isViewable: boolean };

type Props = {
  clips: LiveClip[];
  height: number;
  onReport?: (clip: LiveClip) => void;
  /** Shown behind the empty state, e.g. the venue's cover photo. */
  fallbackImage?: string | null;
};

const SOURCE_LABEL: Record<LiveClip['source'], string | null> = {
  user: null,
  host: 'Official',
  spotter: null,
};

/** Swipe left/right through a venue's live clips. Only the visible clip plays. */
export function ClipCarousel({ clips, height, onReport, fallbackImage }: Props) {
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);

  const onViewableItemsChanged = useState(
    () =>
      ({ viewableItems }: { viewableItems: ViewToken[] }) => {
        const first = viewableItems.find((v) => v.isViewable);
        if (first?.index != null) setActiveIndex(first.index);
      },
  )[0];

  if (clips.length === 0) {
    return (
      <View style={[styles.empty, { height }]} testID="clip-carousel-empty">
        {fallbackImage ? (
          <>
            <Image
              source={{ uri: fallbackImage }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            <View style={styles.emptyPill}>
              <Ionicons name="videocam-outline" size={14} color={colors.white} />
              <Text style={styles.emptyPillText}>No live clips in the last hour</Text>
            </View>
          </>
        ) : (
          <>
            <Ionicons name="videocam-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyText}>No live clips in the last hour.</Text>
            <Text style={styles.emptySub}>Be the first to show the vibe.</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={{ height }}>
      <FlatList
        data={clips}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(c) => c.id}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        renderItem={({ item, index }) => (
          <View style={{ width, height }}>
            {Math.abs(index - activeIndex) <= 1 && (
              <ClipMedia
                url={clipPublicUrl(supabase, item.storage_path)}
                active={index === activeIndex}
                muted={muted}
              />
            )}
            <View style={styles.overlay} pointerEvents="box-none">
              <View style={styles.badges}>
                <Text style={styles.fresh}>● {formatFreshness(item.published_at)} · verified</Text>
                {SOURCE_LABEL[item.source] && (
                  <Text style={styles.official}>{SOURCE_LABEL[item.source]}</Text>
                )}
              </View>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={muted ? 'Unmute' : 'Mute'}
                  onPress={() => setMuted((m) => !m)}
                  style={styles.iconBtn}
                >
                  <Ionicons
                    name={muted ? 'volume-mute' : 'volume-high'}
                    size={18}
                    color={colors.white}
                  />
                </Pressable>
                {onReport && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Report clip"
                    onPress={() => onReport(item)}
                    style={styles.iconBtn}
                  >
                    <Ionicons name="flag-outline" size={18} color={colors.white} />
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        )}
      />
      {clips.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {clips.map((c, i) => (
            <View key={c.id} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  emptyText: { ...typography.body, color: colors.text },
  emptySub: { ...typography.caption, color: colors.textMuted },
  emptyPill: {
    position: 'absolute',
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  emptyPillText: { ...typography.caption, color: colors.white },
  overlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  badges: { flexDirection: 'row', gap: spacing.sm, flexShrink: 1, flexWrap: 'wrap' },
  fresh: {
    ...typography.caption,
    color: colors.white,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  official: {
    ...typography.caption,
    color: colors.white,
    backgroundColor: colors.live,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radii.pill,
    padding: spacing.sm,
  },
  dots: {
    position: 'absolute',
    bottom: spacing.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: colors.white },
});
