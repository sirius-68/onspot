import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { categoryLabel, formatDistance } from '@/features/venues/format';
import { colors, radii, spacing, typography } from '@/theme/tokens';

import type { TonightMapProps } from './TonightMap';

/**
 * Web build: the native Mapbox SDK isn't used on web, so show the same venues as a list.
 * The web export exists for the Squad vote page (Phase 5), not as a full map client.
 */
export function TonightMap({ venues, selectedId, onSelect }: TonightMapProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.note}>The live map is in the mobile app. Venues near you:</Text>
      <FlatList
        data={venues}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: 160 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelect(item)}
            style={[styles.row, item.id === selectedId && styles.rowSelected]}
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {categoryLabel(item.category)} · {formatDistance(item.distance_m)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFill, padding: spacing.lg, paddingTop: 96 },
  note: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowSelected: { borderColor: colors.accent },
  name: { ...typography.heading, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});
