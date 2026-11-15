import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

import { conversationsKey, fetchConversations, fetchMessages, messagesKey } from './api';

export function useConversations() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: conversationsKey,
    queryFn: () => fetchConversations(supabase),
    enabled: !!profile,
    refetchInterval: 15_000,
  });
}

/** Messages for one chat: live via Realtime, with a short poll as a fallback. */
export function useMessages(conversationId: string | null) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return useQuery({
    queryKey: messagesKey(conversationId ?? ''),
    queryFn: () => fetchMessages(supabase, conversationId as string),
    enabled: !!conversationId,
    refetchInterval: 4_000,
  });
}
