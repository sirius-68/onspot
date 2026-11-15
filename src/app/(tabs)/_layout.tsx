import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { type BottomTabBarProps, Tabs } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRequireProfile } from '@/features/auth/useRequireProfile';
import { colors, spacing } from '@/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: Record<string, { icon: IconName; active: IconName; label: string }> = {
  feed: { icon: 'compass-outline', active: 'compass', label: 'Feed' },
  index: { icon: 'map-outline', active: 'map', label: 'Map' },
  create: { icon: 'add', active: 'add', label: 'Post a live clip' },
  plans: { icon: 'ticket-outline', active: 'ticket', label: 'Plans' },
  chats: { icon: 'chatbubble-ellipses-outline', active: 'chatbubble-ellipses', label: 'Chats' },
};

/** Tab bar from the references: outline icons, blue when active with a dot underneath. */
function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const requireProfile = useRequireProfile();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;
        const isCreate = route.name === 'create';
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: focused }}
            testID={`tab-${route.name}`}
            style={styles.item}
            hitSlop={6}
            onPress={() => {
              if (isCreate) {
                if (requireProfile()) router.push('/capture');
                return;
              }
              if (!focused) navigateToTab(route.key);
            }}
          >
            <Ionicons
              name={focused ? tab.active : tab.icon}
              size={isCreate ? 30 : 25}
              color={focused ? colors.blue : colors.textMuted}
            />
            <View style={[styles.dot, focused && !isCreate && styles.dotOn]} />
          </Pressable>
        );
      })}
    </View>
  );
}

// The app opens on the map (index); Feed sits to its left in the tab bar.
export const unstable_settings = { initialRouteName: 'index' };

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
      <Tabs.Screen name="index" options={{ title: 'Map' }} />
      <Tabs.Screen name="create" options={{ title: 'Post' }} />
      <Tabs.Screen name="plans" options={{ title: 'Plans' }} />
      <Tabs.Screen name="chats" options={{ title: 'Chats' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotOn: { backgroundColor: colors.blue },
});
