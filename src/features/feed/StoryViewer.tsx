import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { ClipMedia } from '@/components/ClipPlayer';
import { clipPublicUrl } from '@/features/clips/api';
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing, typography } from '@/theme/tokens';

import { buildStories, timeAgo } from './api';
import { useFeed } from './hooks';

const SECONDS_PER_ITEM = 6;

/** Full-screen story: one person's clips from the last hour. Tap right/left to move. */
export function StoryViewer() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const insets = useSafeAreaInsets();
  const feed = useFeed();
  const story = useMemo(
    () =>
      buildStories(feed.data ?? [], new Date(), 24 * 60).find((s) => s.authorId === userId) ?? null,
    [feed.data, userId],
  );
  const [index, setIndex] = useState(0);
  const clip = story?.clips[index];

  // Auto-advance; closes after the last clip.
  useEffect(() => {
    if (!story) return;
    const t = setTimeout(() => {
      if (index < story.clips.length - 1) setIndex(index + 1);
      else router.back();
    }, SECONDS_PER_ITEM * 1000);
    return () => clearTimeout(t);
  }, [index, story]);

  if (!story || !clip) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.text}>This story has ended.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ClipMedia url={clipPublicUrl(supabase, clip.storage_path)} active muted={false} />
      <View style={styles.tapRow}>
        <Pressable
          style={{ flex: 1 }}
          accessibilityLabel="Previous"
          onPress={() => setIndex((i) => Math.max(0, i - 1))}
        />
        <Pressable
          style={{ flex: 2 }}
          accessibilityLabel="Next"
          onPress={() => (index < story.clips.length - 1 ? setIndex(index + 1) : router.back())}
        />
      </View>

      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View style={styles.bars}>
          {story.clips.map((c, i) => (
            <View key={c.clip_id} style={[styles.bar, i <= index && styles.barOn]} />
          ))}
        </View>
        <View style={styles.who}>
          <Avatar name={story.name} url={story.avatarUrl} size={36} ring />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{story.name}</Text>
            <Text style={styles.meta}>
              {clip.venue_name} · {timeAgo(clip.published_at)}
            </Text>
          </View>
          <Pressable accessibilityLabel="Close" onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={28} color={colors.white} />
          </Pressable>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          router.back();
          router.push(`/venue/${clip.venue_id}`);
        }}
        style={[styles.cta, { bottom: insets.bottom + spacing.xl }]}
      >
        <Ionicons name="location" size={16} color={colors.text} />
        <Text style={styles.ctaText}>See {clip.venue_name}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  text: { ...typography.body, color: colors.white },
  link: { ...typography.heading, color: colors.accent },
  tapRow: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  top: { position: 'absolute', left: spacing.md, right: spacing.md, gap: spacing.md },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  barOn: { backgroundColor: colors.white },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { ...typography.heading, color: colors.white },
  meta: { ...typography.caption, color: 'rgba(255,255,255,0.85)' },
  cta: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  ctaText: { ...typography.heading, color: colors.text },
});
