import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { colors, shadow, spacing, typography } from '@/theme/tokens';

import { Avatar } from './Avatar';

type Props = { title?: string; badge?: number };

/** Top bar from the references: your avatar (profile) on the left, the bell on the right. */
export function AppHeader({ title, badge = 0 }: Props) {
  const { profile } = useAuth();
  return (
    <View style={styles.row} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Your profile"
        onPress={() => router.push('/profile')}
        style={styles.round}
        testID="header-profile"
      >
        <Avatar
          name={profile?.display_name ?? profile?.username ?? 'You'}
          url={profile?.avatar_url}
          size={40}
        />
      </Pressable>
      {title ? <Text style={styles.title}>{title}</Text> : <View />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        onPress={() => router.push('/notifications')}
        style={[styles.round, styles.bell]}
        testID="header-bell"
      >
        <Ionicons name="notifications" size={20} color={colors.textMuted} />
        {badge > 0 && <View style={styles.dot} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bell: { backgroundColor: colors.white, ...shadow, shadowOpacity: 0.08 },
  title: { ...typography.heading, color: colors.text },
  dot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
});
