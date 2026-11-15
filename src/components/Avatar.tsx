import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { venueInitials } from '@/features/venues/format';
import { colors } from '@/theme/tokens';

const PASTELS = ['#D9CCFF', '#FFD9C2', '#C9E8FF', '#FFE08A', '#CFF5D7', '#FFD1E0'];

function pastel(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PASTELS[h % PASTELS.length] as string;
}

type Props = {
  name: string;
  url?: string | null;
  size?: number;
  /** White ring, used when the avatar sits on a photo or the map. */
  ring?: boolean;
  style?: ViewStyle;
};

/** Round avatar: the photo when there is one, otherwise initials on a pastel circle. */
export function Avatar({ name, url, size = 40, ring = false, style }: Props) {
  const [failed, setFailed] = useState(false);
  const box = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: pastel(name),
  };
  return (
    <View
      style={[styles.wrap, box, ring && { borderWidth: Math.max(2, size / 14) }, style]}
      accessibilityLabel={name}
    >
      {url && !failed ? (
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{venueInitials(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.white,
  },
  initials: { color: colors.text, fontWeight: '700' },
});
