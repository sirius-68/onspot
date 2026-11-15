import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatMoney } from '@/features/chat/api';
import { useConversations } from '@/features/chat/hooks';
import { respondFriendRequest } from '@/features/friends/api';
import { friendLocationsKey, friendsKey, useFriends } from '@/features/friends/hooks';
import { closesInText, fetchMySquads } from '@/features/squads/api';
import { errorText } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing, typography } from '@/theme/tokens';

/** The bell: friend requests, ticket splits waiting for you, and your squad votes. */
export function NotificationsScreen() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [openedAt] = useState(() => Date.now());
  const friends = useFriends();
  const conversations = useConversations();
  const squads = useQuery({
    queryKey: ['my-squads'],
    queryFn: () => fetchMySquads(supabase),
    enabled: !!session,
  });

  const requests = (friends.data ?? []).filter((f) => f.state === 'incoming');
  const splits = (conversations.data ?? []).filter(
    (c) => c.last_kind === 'split' && !c.last_sender_is_me,
  );
  const votes = (squads.data ?? []).filter((s) => Date.parse(s.closes_at) > openedAt);
  const nothing = requests.length + splits.length + votes.length === 0;

  async function respond(requestId: string, accept: boolean) {
    try {
      await respondFriendRequest(supabase, requestId, accept);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: friendsKey }),
        queryClient.invalidateQueries({ queryKey: friendLocationsKey }),
        queryClient.invalidateQueries({ queryKey: ['feed'] }),
      ]);
    } catch (e) {
      Alert.alert('Something went wrong', errorText(e));
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {nothing && <Text style={styles.empty}>You’re all caught up.</Text>}

        {requests.map((r) => (
          <View key={r.request_id} style={styles.row} testID="notif-request">
            <Avatar name={r.display_name ?? r.username} url={r.avatar_url} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{r.display_name ?? r.username}</Text>
              <Text style={styles.muted}>wants to be friends</Text>
            </View>
            <Pressable style={styles.accept} onPress={() => respond(r.request_id, true)}>
              <Text style={styles.acceptText}>Accept</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Decline"
              style={styles.decline}
              onPress={() => respond(r.request_id, false)}
            >
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ))}

        {splits.map((c) => (
          <Pressable
            key={c.conversation_id}
            style={styles.row}
            onPress={() => router.push(`/chat/${c.conversation_id}`)}
          >
            <Avatar name={c.display_name ?? c.username} url={c.avatar_url} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{c.display_name ?? c.username}</Text>
              <Text style={styles.muted}>
                asked you for {formatMoney(c.last_amount_minor ?? 0, c.last_currency ?? 'GBP')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}

        {votes.map((s) => (
          <Pressable key={s.code} style={styles.row} onPress={() => router.push(`/s/${s.code}`)}>
            <View style={styles.icon}>
              <Ionicons name="people" size={22} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{s.title}</Text>
              <Text style={styles.muted}>
                {s.total_votes} {Number(s.total_votes) === 1 ? 'vote' : 'votes'} ·{' '}
                {closesInText(s.closes_at)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { ...typography.heading, color: colors.text },
  content: { padding: spacing.lg, gap: spacing.sm },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  name: { ...typography.heading, color: colors.text },
  muted: { ...typography.caption, color: colors.textMuted },
  accept: {
    backgroundColor: colors.blue,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  acceptText: { ...typography.caption, color: colors.white, fontWeight: '700' },
  decline: { padding: spacing.xs },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
