import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

import { type FeedRow, feedKey, fetchFeed, toggleReaction } from './api';

export function useFeed() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: feedKey,
    queryFn: () => fetchFeed(supabase),
    enabled: !!profile,
    refetchInterval: 60_000,
  });
}

/** Fire reaction with an instant (optimistic) update. */
export function useToggleReaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clipId: string) => toggleReaction(supabase, clipId),
    onMutate: async (clipId) => {
      await queryClient.cancelQueries({ queryKey: feedKey });
      const before = queryClient.getQueryData<FeedRow[]>(feedKey);
      queryClient.setQueryData<FeedRow[]>(feedKey, (rows) =>
        rows?.map((r) =>
          r.clip_id === clipId
            ? { ...r, i_reacted: !r.i_reacted, reactions: r.reactions + (r.i_reacted ? -1 : 1) }
            : r,
        ),
      );
      return { before };
    },
    onError: (_e, _id, ctx) => queryClient.setQueryData(feedKey, ctx?.before),
    onSettled: () => queryClient.invalidateQueries({ queryKey: feedKey }),
  });
}
