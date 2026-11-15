import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DefaultTheme, type ErrorBoundaryProps, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/features/auth/AuthProvider';
import { track } from '@/lib/analytics';
import { colors, spacing, typography } from '@/theme/tokens';

// Closes the auth popup on web after an OAuth redirect.
WebBrowser.maybeCompleteAuthSession();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

/** Shown instead of a white screen if a screen crashes. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.md,
      }}
    >
      <Text style={{ ...typography.title, color: colors.text }}>Something broke</Text>
      <Text style={{ ...typography.caption, color: colors.textMuted, textAlign: 'center' }}>
        {error.message}
      </Text>
      <Pressable onPress={retry}>
        <Text style={{ ...typography.heading, color: colors.accent }}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );

  useEffect(() => {
    track('app_open');
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemeProvider value={navigationTheme}>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background },
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal' }} />
                <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
                <Stack.Screen name="squad/new" options={{ presentation: 'modal' }} />
                <Stack.Screen
                  name="story/[userId]"
                  options={{ presentation: 'fullScreenModal', animation: 'fade' }}
                />
              </Stack>
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
