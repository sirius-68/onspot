import { StyleSheet, View } from 'react-native';

import type { FriendLocation } from '@/features/friends/api';
import { colors, shadow } from '@/theme/tokens';

import { Avatar } from './Avatar';

type Props = { name: string; avatarUrl?: string | null; size?: number; me?: boolean };

/** Round avatar bubble on the map (purple ring like the reference); you get a blue ring. */
export function MapBubble({ name, avatarUrl, size = 52, me = false }: Props) {
  return (
    <View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2 },
        me && { backgroundColor: colors.blue },
      ]}
      accessibilityLabel={me ? 'You are here' : `${name} is here`}
    >
      <Avatar name={name} url={avatarUrl} size={size - 10} />
    </View>
  );
}

/** A friend on the map (friends only — strangers are never shown). */
export function FriendBubble({ friend }: { friend: FriendLocation }) {
  return (
    <MapBubble
      name={friend.display_name ?? friend.username}
      avatarUrl={friend.avatar_url}
      size={46}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    ...shadow,
  },
});
