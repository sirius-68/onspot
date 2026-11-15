import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import type { LiveClip } from '@/features/clips/types';
import { blockUser } from '@/features/friends/api';
import { track } from '@/lib/analytics';
import { errorText, unwrap } from '@/lib/errors';
import { ensureSession, supabase } from '@/lib/supabase';

export const REPORT_REASONS = [
  { key: 'not_this_venue', label: 'Not this venue / old clip' },
  { key: 'nudity', label: 'Nudity or sexual content' },
  { key: 'violence', label: 'Violence or danger' },
  { key: 'harassment', label: 'Harassment or filming someone without consent' },
  { key: 'minor', label: 'Someone under 18' },
  { key: 'drugs', label: 'Drugs' },
  { key: 'spam', label: 'Spam' },
] as const;

export async function reportClip(clipId: string, reason: string) {
  await ensureSession();
  unwrap(await supabase.rpc('report_clip', { p_clip_id: clipId, p_reason: reason }));
}

/** Report sheet for a clip, with an option to block its author. */
export function useReportClip() {
  const queryClient = useQueryClient();
  return useCallback(
    (clip: LiveClip) => {
      Alert.alert('Report this clip', 'Why are you reporting it?', [
        ...REPORT_REASONS.map((r) => ({
          text: r.label,
          onPress: async () => {
            try {
              await reportClip(clip.id, r.key);
              track('report_sent', { reason: r.key });
              Alert.alert(
                'Thanks',
                'We’ll review it. Clips with several reports are hidden right away.',
                [
                  { text: 'OK' },
                  {
                    text: 'Also block this person',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await blockUser(supabase, clip.author_id);
                        await queryClient.invalidateQueries({ queryKey: ['live-clips'] });
                      } catch (e) {
                        Alert.alert('Couldn’t block', errorText(e));
                      }
                    },
                  },
                ],
              );
            } catch (e) {
              Alert.alert('Couldn’t send report', errorText(e));
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [queryClient],
  );
}
