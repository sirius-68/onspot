import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { isPhotoUrl } from '@/components/ClipPlayer';
import { PhotoCard } from '@/components/PhotoCard';
import { useRequireProfile } from '@/features/auth/useRequireProfile';
import { openChatWith } from '@/features/chat/api';
import { clipPublicUrl } from '@/features/clips/api';
import { useFriends } from '@/features/friends/hooks';
import { errorText } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing, typography } from '@/theme/tokens';

import { buildPosts, buildStories, type FeedRow, type Post, timeAgo } from './api';
import { useFeed, useToggleReaction } from './hooks';

const STORY_W = 104;
const STORY_H = 136;

/** Media for a feed card: the clip itself when it's a photo, else the venue cover + play icon. */
export function feedThumb(row: FeedRow): { uri: string | null; isVideo: boolean } {
  const url = clipPublicUrl(supabase, row.storage_path);
  if (isPhotoUrl(url)) return { uri: url, isVideo: false };
  return { uri: row.venue_cover_url, isVideo: true };
}

/** Feed tab: friends' stories on top, then where friends have been posting from. */
export function FeedScreen() {
  const feed = useFeed();
  const friends = useFriends();
  const requireProfile = useRequireProfile();
  const stories = useMemo(() => buildStories(feed.data ?? []), [feed.data]);
  const posts = useMemo(() => buildPosts(feed.data ?? []), [feed.data]);
  const incoming = (friends.data ?? []).filter((f) => f.state === 'incoming').length;

  const header = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.stories}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add story"
        onPress={() => requireProfile() && router.push('/capture')}
        style={styles.addStory}
        testID="add-story"
      >
        <View style={styles.addIcon}>
          <Ionicons name="add" size={18} color={colors.white} />
        </View>
        <Text style={styles.addText}>Add story</Text>
      </Pressable>
      {stories.map((s) => {
        const thumb = feedThumb(s.clips[s.clips.length - 1] as FeedRow);
        return (
          <Pressable
            key={s.authorId}
            accessibilityRole="button"
            accessibilityLabel={`${s.name}'s story`}
            onPress={() => router.push(`/story/${s.authorId}`)}
          >
            <PhotoCard uri={thumb.uri} label={s.name} width={STORY_W} height={STORY_H}>
              <Avatar name={s.name} url={s.avatarUrl} size={30} ring style={styles.storyAvatar} />
            </PhotoCard>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader badge={incoming} />
      <FlatList
        data={posts}
        keyExtractor={(p) => p.key}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching}
            onRefresh={() => void feed.refetch()}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          feed.isPending ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {feed.isError ? errorText(feed.error) : 'Nothing from friends yet'}
              </Text>
              <Text style={styles.muted}>
                Add friends to see where they’re going tonight, or post the first clip.
              </Text>
              <Pressable onPress={() => router.push('/profile')}>
                <Text style={styles.link}>Find friends</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => <PostCard post={item} />}
      />
    </SafeAreaView>
  );
}

function PostCard({ post }: { post: Post }) {
  const react = useToggleReaction();
  const count = post.clips.length;
  return (
    <View style={styles.post} testID="feed-post">
      <View style={styles.postHead}>
        <Avatar name={post.name} url={post.avatarUrl} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{post.name}</Text>
          <Text style={styles.muted} numberOfLines={1}>
            Posted {count === 1 ? 'a clip' : `${count} clips`} at{' '}
            <Text style={styles.venueLink} onPress={() => router.push(`/venue/${post.venueId}`)}>
              {post.venueName}
            </Text>
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Open venue"
          onPress={() => router.push(`/venue/${post.venueId}`)}
          hitSlop={10}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.photos}
      >
        {post.clips.map((c) => {
          const thumb = feedThumb(c);
          return (
            <Pressable
              key={c.clip_id}
              accessibilityRole="button"
              accessibilityLabel={`Clip at ${post.venueName}`}
              onPress={() => router.push(`/story/${post.authorId}`)}
            >
              <PhotoCard uri={thumb.uri} label={post.venueName} width={168} height={200}>
                {thumb.isVideo && (
                  <View style={styles.play}>
                    <Ionicons name="play" size={18} color={colors.white} />
                  </View>
                )}
              </PhotoCard>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={post.iReacted ? 'Remove fire' : 'Give a fire'}
          onPress={() => react.mutate((post.clips[0] as FeedRow).clip_id)}
          style={styles.action}
          testID="feed-react"
        >
          <Ionicons
            name={post.iReacted ? 'flame' : 'flame-outline'}
            size={20}
            color={post.iReacted ? colors.accent : colors.textMuted}
          />
          <Text style={[styles.count, post.iReacted && { color: colors.accent }]}>
            {post.reactions}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Message ${post.name}`}
          onPress={() => void openChatWith(post.authorId)}
          style={styles.action}
        >
          <Ionicons name="chatbubble-outline" size={19} color={colors.textMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share"
          onPress={() =>
            void Share.share({
              message: `${post.name} is at ${post.venueName} tonight — on Onspot`,
            })
          }
          style={styles.action}
        >
          <Ionicons name="arrow-redo-outline" size={20} color={colors.textMuted} />
        </Pressable>
        <Text style={[styles.muted, { marginLeft: 'auto' }]}>{timeAgo(post.latest)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  stories: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  addStory: {
    width: STORY_W,
    height: STORY_H,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#C9C9D1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { ...typography.caption, color: colors.textMuted },
  storyAvatar: { position: 'absolute', top: 8, left: 8 },
  post: { paddingTop: spacing.lg, gap: spacing.md },
  postHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  name: { ...typography.heading, color: colors.text },
  muted: { ...typography.caption, color: colors.textMuted },
  venueLink: { color: colors.blue },
  photos: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  play: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 16,
    padding: 6,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  count: { ...typography.caption, color: colors.textMuted },
  empty: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  emptyTitle: { ...typography.heading, color: colors.text, textAlign: 'center' },
  link: { ...typography.heading, color: colors.blue, marginTop: spacing.sm },
});
