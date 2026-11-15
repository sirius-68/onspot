import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { colors, spacing, typography } from '@/theme/tokens';

import { LEGAL, type LegalDoc } from './content';

export function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const content = LEGAL[(doc as LegalDoc) ?? 'privacy'] ?? LEGAL.privacy;
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{content.title}</Text>
        {content.sections.map((s) => (
          <Text key={s.heading} style={styles.body}>
            <Text style={styles.heading}>
              {s.heading}
              {'\n'}
            </Text>
            {s.body}
          </Text>
        ))}
        <Button
          title="Back"
          variant="ghost"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    maxWidth: 680,
    alignSelf: 'center',
    width: '100%',
  },
  title: { ...typography.title, color: colors.text },
  heading: { ...typography.heading, color: colors.text },
  body: { ...typography.body, color: colors.textMuted, lineHeight: 22 },
});
