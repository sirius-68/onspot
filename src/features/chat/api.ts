import type { SupabaseClient } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { errorText, unwrap } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export type ConversationRow = {
  conversation_id: string;
  other_user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  last_kind: 'text' | 'split' | null;
  last_body: string | null;
  last_amount_minor: number | null;
  last_currency: string | null;
  last_sender_is_me: boolean | null;
  last_at: string;
  unread: number;
};

export type Message = {
  id: string;
  sender_id: string;
  kind: 'text' | 'split';
  body: string | null;
  amount_minor: number | null;
  currency: string | null;
  paid_at: string | null;
  created_at: string;
};

export const conversationsKey = ['conversations'] as const;
export const messagesKey = (id: string) => ['messages', id] as const;

export async function fetchConversations(client: SupabaseClient): Promise<ConversationRow[]> {
  return (unwrap(await client.rpc('my_conversations')) as ConversationRow[] | null) ?? [];
}

export async function openDirectConversation(client: SupabaseClient, userId: string) {
  return unwrap(await client.rpc('open_direct_conversation', { p_user_id: userId })) as string;
}

export async function fetchMessages(client: SupabaseClient, id: string): Promise<Message[]> {
  return (
    (unwrap(await client.rpc('conversation_messages', { p_conversation_id: id })) as
      Message[] | null) ?? []
  );
}

export async function sendMessage(client: SupabaseClient, id: string, body: string) {
  unwrap(await client.rpc('send_message', { p_conversation_id: id, p_body: body }));
}

export async function sendSplitRequest(
  client: SupabaseClient,
  id: string,
  amountMinor: number,
  currency: string,
  note: string,
) {
  unwrap(
    await client.rpc('send_split_request', {
      p_conversation_id: id,
      p_amount_minor: amountMinor,
      p_currency: currency,
      p_note: note,
    }),
  );
}

export async function markSplitPaid(client: SupabaseClient, messageId: string) {
  unwrap(await client.rpc('mark_split_paid', { p_message_id: messageId }));
}

/** Opens (or creates) the chat with a friend and navigates to it. */
export async function openChatWith(userId: string) {
  try {
    const id = await openDirectConversation(supabase, userId);
    router.push(`/chat/${id}`);
  } catch (e) {
    Alert.alert('Can’t open chat', errorText(e, 'You can message friends only.'));
  }
}

/** "£15.00" from minor units. */
export function formatMoney(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

/** Parses "15", "15.5", "£15.50" into minor units; null when invalid. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[^0-9.,]/g, '').replace(',', '.');
  if (!/^\d{1,5}(\.\d{0,2})?$/.test(cleaned)) return null;
  const minor = Math.round(Number(cleaned) * 100);
  return minor > 0 && minor <= 1_000_000 ? minor : null;
}

/** One-line preview for the chat list. */
export function previewText(c: ConversationRow): string {
  if (!c.last_kind) return 'Say hi 👋';
  if (c.last_kind === 'split') {
    const amount = formatMoney(c.last_amount_minor ?? 0, c.last_currency ?? 'GBP');
    return c.last_sender_is_me ? `You asked for ${amount}` : `Asked you for ${amount}`;
  }
  return (c.last_sender_is_me ? 'You: ' : '') + (c.last_body ?? '');
}

/** "Today 1:05 AM", "Yesterday 14:01", or a date: the separators between messages. */
export function dayLabel(iso: string, now: Date = new Date()): { day: string; time: string } {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  const day =
    diffDays === 0
      ? 'Today'
      : diffDays === 1
        ? 'Yesterday'
        : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return { day, time };
}
