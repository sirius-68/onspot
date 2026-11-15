import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field, SectionTitle } from '@/components/ui';
import { profileKey, useAuth } from '@/features/auth/AuthProvider';
import {
  blockUser,
  friendRequestResultText,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
  setGhostMode,
} from '@/features/friends/api';
import { friendsKey, useFriends } from '@/features/friends/hooks';
import { venueInitials } from '@/features/venues/format';
import { track } from '@/lib/analytics';
import { env } from '@/lib/env';
import { errorText, unwrap } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing, typography } from '@/theme/tokens';

export function ProfileScreen() {
  const { hasAccount, profile, loading } = useAuth();
  const queryClient = useQueryClient();
  const friends = useFriends();
  const hosted = useQuery({
    queryKey: ['hosted-venues'],
    queryFn: async () =>
      (unwrap(await supabase.rpc('my_hosted_venues')) as
        { venue_id: string; name: string }[] | null) ?? [],
    enabled: !!profile,
  });
  const [addName, setAddName] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  if (loading) return <SafeAreaView style={styles.screen} />;

  if (!hasAccount || !profile) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <Text style={styles.title}>Your Onspot</Text>
          <Text style={styles.body}>
            Sign in to post live clips, see friends on the map, and start squad votes.
          </Text>
          <Button
            title={hasAccount ? 'Finish your profile' : 'Sign in'}
            onPress={() => router.push(hasAccount ? '/onboarding' : '/sign-in')}
          />
          <LegalLinks />
        </View>
      </SafeAreaView>
    );
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: friendsKey });
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await refresh();
    } catch (e) {
      Alert.alert('Something went wrong', errorText(e));
    }
  };

  const rows = friends.data ?? [];
  const incoming = rows.filter((r) => r.state === 'incoming');
  const accepted = rows.filter((r) => r.state === 'friend');
  const outgoing = rows.filter((r) => r.state === 'outgoing');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {venueInitials(profile.display_name ?? profile.username)}
            </Text>
          </View>
          <View>
            <Text style={styles.title}>{profile.display_name ?? profile.username}</Text>
            <Text style={styles.body}>@{profile.username}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Ghost Mode</Text>
            <Text style={styles.body}>Hide your location from all friends.</Text>
          </View>
          <Switch
            value={profile.ghost_mode}
            onValueChange={(on) =>
              act(async () => {
                await setGhostMode(supabase, on);
                await queryClient.invalidateQueries({ queryKey: profileKey });
              })
            }
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>

        <SectionTitle>Add a friend</SectionTitle>
        <Field
          label="Username"
          value={addName}
          onChangeText={setAddName}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="their_username"
        />
        <Button
          title="Send request"
          variant="secondary"
          disabled={addName.trim().length < 3}
          onPress={() =>
            act(async () => {
              const result = await sendFriendRequest(supabase, addName);
              setMessage(friendRequestResultText(result));
              setAddName('');
              track('friend_added');
            })
          }
        />
        {!!message && <Text style={styles.ok}>{message}</Text>}

        {incoming.length > 0 && <SectionTitle>Requests</SectionTitle>}
        {incoming.map((r) => (
          <View key={r.request_id} style={styles.row}>
            <Text style={[styles.rowTitle, { flex: 1 }]}>@{r.username}</Text>
            <Button
              title="Accept"
              onPress={() => act(() => respondFriendRequest(supabase, r.request_id, true))}
            />
            <Button
              title="Decline"
              variant="ghost"
              onPress={() => act(() => respondFriendRequest(supabase, r.request_id, false))}
            />
          </View>
        ))}

        <SectionTitle>{`Friends (${accepted.length})`}</SectionTitle>
        {accepted.length === 0 && (
          <Text style={styles.body}>No friends yet. Add them by username.</Text>
        )}
        {accepted.map((r) => (
          <Pressable
            key={r.request_id}
            style={styles.row}
            onLongPress={() =>
              Alert.alert(`@${r.username}`, undefined, [
                {
                  text: 'Remove friend',
                  onPress: () => act(() => removeFriend(supabase, r.user_id)),
                },
                {
                  text: 'Block',
                  style: 'destructive',
                  onPress: () => act(() => blockUser(supabase, r.user_id)),
                },
                { text: 'Cancel', style: 'cancel' },
              ])
            }
          >
            <Text style={styles.rowTitle}>{r.display_name ?? r.username}</Text>
            <Text style={styles.body}>@{r.username}</Text>
          </Pressable>
        ))}
        {outgoing.length > 0 && (
          <Text style={styles.body}>
            Waiting on: {outgoing.map((r) => '@' + r.username).join(', ')}
          </Text>
        )}

        {((hosted.data?.length ?? 0) > 0 || profile.role === 'admin') && (
          <Button title="Host mode" variant="secondary" onPress={() => router.push('/host')} />
        )}
        {(profile.role === 'spotter' || profile.role === 'admin') && (
          <Button
            title="Spotter mode"
            variant="secondary"
            onPress={() => router.push('/spotter')}
          />
        )}
        {profile.role === 'admin' && (
          <Button title="Admin" variant="secondary" onPress={() => router.push('/admin')} />
        )}

        <LegalLinks />
        {env.demoMode ? (
          <>
            <Text style={styles.demoNote}>
              Demo mode: you’re signed in as a guest and everything is saved on this phone only.
            </Text>
            <Button
              title="Reset demo data"
              variant="secondary"
              onPress={() =>
                Alert.alert(
                  'Reset demo data?',
                  'Clears your clips, squads, friends and host updates.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Reset',
                      style: 'destructive',
                      onPress: () =>
                        act(async () => {
                          await supabase.auth.signOut();
                          await queryClient.resetQueries();
                        }),
                    },
                  ],
                )
              }
            />
          </>
        ) : (
          <>
            <Button
              title="Sign out"
              variant="secondary"
              onPress={() => act(() => supabase.auth.signOut())}
            />
            <Button
              title="Delete my account"
              variant="danger"
              onPress={() =>
                Alert.alert(
                  'Delete your account?',
                  'Your profile, friends, clips and votes are deleted. This can’t be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () =>
                        act(async () => {
                          unwrap(await supabase.rpc('delete_my_account'));
                          await supabase.auth.signOut();
                        }),
                    },
                  ],
                )
              }
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LegalLinks() {
  return (
    <View style={styles.legal}>
      {(
        [
          ['privacy', 'Privacy'],
          ['terms', 'Terms'],
          ['guidelines', 'Community guidelines'],
        ] as const
      ).map(([doc, label]) => (
        <Pressable key={doc} onPress={() => router.push(`/legal/${doc}`)}>
          <Text style={styles.link}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  demoNote: { ...typography.caption, color: colors.warning },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.heading, color: colors.accent },
  title: { ...typography.title, color: colors.text },
  body: { ...typography.caption, color: colors.textMuted },
  ok: { ...typography.caption, color: colors.live },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowTitle: { ...typography.heading, color: colors.text },
  legal: { flexDirection: 'row', gap: spacing.lg, justifyContent: 'center', marginTop: spacing.lg },
  link: { ...typography.caption, color: colors.textMuted, textDecorationLine: 'underline' },
});
