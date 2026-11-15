import { router } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { timeAgo } from '@/features/feed/api';
import { useFriends } from '@/features/friends/hooks';
import { errorText } from '@/lib/errors';
import { colors, radii, spacing, typography } from '@/theme/tokens';

import { openChatWith, previewText } from './api';
import { useConversations } from './hooks';

/** Chats tab: friends to start a chat with, then your conversations. */
export function ChatsScreen() {
  const conversations = useConversations();
  const friends = useFriends();
  const accepted = (friends.data ?? []).filter((f) => f.state === 'friend');
  const incoming = (friends.data ?? []).filter((f) => f.state === 'incoming').length;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader title="Chats" badge={incoming} />
      <FlatList
        data={conversations.data ?? []}
        keyExtractor={(c) => c.conversation_id}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        ListHeaderComponent={
          accepted.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.friends}
            >
              {accepted.map((f) => (
                <Pressable
                  key={f.user_id}
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${f.display_name ?? f.username}`}
                  onPress={() => void openChatWith(f.user_id)}
                  style={styles.friend}
                >
                  <Avatar name={f.display_name ?? f.username} url={f.avatar_url} size={56} />
                  <Text style={styles.friendName} numberOfLines={1}>
                    {f.display_name ?? f.username}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : undefined
        }
        ListEmptyComponent={
          conversations.isPending ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
          ) : (
            <Text style={styles.empty}>
              {conversations.isError
                ? errorText(conversations.error)
                : 'No chats yet. Tap a friend above to plan tonight.'}
            </Text>
          )
        }
        renderItem={({ item }) => {
          const name = item.display_name ?? item.username;
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/chat/${item.conversation_id}`)}
              style={styles.row}
              testID="chat-row"
            >
              <Avatar name={name} url={item.avatar_url} size={52} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name}>{name}</Text>
                <Text
                  style={[styles.preview, item.unread > 0 && styles.previewUnread]}
                  numberOfLines={1}
                >
                  {previewText(item)}
                </Text>
              </View>
              <View style={styles.side}>
                <Text style={styles.time}>{timeAgo(item.last_at)}</Text>
                {item.unread > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unread}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  friends: { gap: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  friend: { alignItems: 'center', gap: spacing.xs, width: 64 },
  friendName: { ...typography.caption, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  name: { ...typography.heading, color: colors.text },
  preview: { ...typography.body, color: colors.textMuted },
  previewUnread: { color: colors.text, fontWeight: '600' },
  side: { alignItems: 'flex-end', gap: spacing.xs },
  time: { ...typography.caption, color: colors.textMuted },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.white },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
});
