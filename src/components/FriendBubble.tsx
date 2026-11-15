import { StyleSheet, Text, View } from 'react-native';

import type { FriendLocation } from '@/features/friends/api';
import { venueInitials } from '@/features/venues/format';
import { colors, typography } from '@/theme/tokens';

/** A friend on the map (friends only — strangers are never shown). */
export function FriendBubble({ friend }: { friend: FriendLocation }) {
  return (
    <View
      style={styles.wrap}
      accessibilityLabel={`${friend.display_name ?? friend.username} is here`}
    >
      <View style={styles.bubble}>
        <Text style={styles.initials}>{venueInitials(friend.display_name ?? friend.username)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  bubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#7C5CFF',
    borderWidth: 2,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { ...typography.caption, color: '#fff', fontWeight: '700' },
});
