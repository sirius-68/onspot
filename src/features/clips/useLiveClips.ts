import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

import { fetchLiveClips } from './api';

export const liveClipsKey = (venueId: string) => ['live-clips', venueId] as const;

/**
 * Live clips for a venue. Refreshes when a clip for this venue changes (Supabase Realtime)
 * and every minute so clips older than 60 minutes drop out. One channel per open venue,
 * removed on unmount (debugging list D9).
 */
export function useLiveClips(venueId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!venueId || env.demoMode) return;
    const channel = supabase
      .channel(`clips:${venueId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clips', filter: `venue_id=eq.${venueId}` },
        () => queryClient.invalidateQueries({ queryKey: liveClipsKey(venueId) }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [venueId, queryClient]);

  return useQuery({
    queryKey: liveClipsKey(venueId ?? ''),
    queryFn: () =>
      env.demoMode ? Promise.resolve([]) : fetchLiveClips(supabase, venueId as string),
    enabled: !!venueId,
    refetchInterval: 60_000,
  });
}
