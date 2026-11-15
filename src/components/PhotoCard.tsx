import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { venueInitials } from '@/features/venues/format';
import { colors, radii, shadow } from '@/theme/tokens';

type Props = {
  uri?: string | null;
  /** Shown as initials when there is no photo or it fails to load. */
  label: string;
  width: number;
  height: number;
  radius?: number;
  border?: number;
  style?: ViewStyle;
  children?: React.ReactNode;
};

/** Rounded photo with a white border and soft shadow (the card style from the references). */
export function PhotoCard({
  uri,
  label,
  width,
  height,
  radius = radii.lg,
  border = 3,
  style,
  children,
}: Props) {
  const [failed, setFailed] = useState(false);
  return (
    <View
      style={[styles.card, { width, height, borderRadius: radius, borderWidth: border }, style]}
    >
      <View style={[styles.inner, { borderRadius: radius - border }]}>
        {uri && !failed ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
            onError={() => setFailed(true)}
          />
        ) : (
          <View style={styles.fallback}>
            <Text style={styles.initials}>{venueInitials(label)}</Text>
          </View>
        )}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderColor: colors.white, backgroundColor: colors.white, ...shadow },
  inner: { flex: 1, overflow: 'hidden', backgroundColor: colors.surface },
  fallback: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFE3D6',
  },
  initials: { fontSize: 20, fontWeight: '800', color: colors.accent },
});
