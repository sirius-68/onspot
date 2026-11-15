import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';

import { unwrap } from '@/lib/errors';

export type SquadOption = {
  option_id: string;
  venue_id: string;
  name: string;
  category: string;
  cover_photo_url: string | null;
  votes: number;
  voters: string[];
};

export type Squad = {
  code: string;
  title: string;
  closes_at: string;
  closed: boolean;
  creator_username: string | null;
  is_creator: boolean;
  total_votes: number;
  my_option_id: string | null;
  options: SquadOption[];
};

export type SquadSummary = {
  code: string;
  title: string;
  closes_at: string;
  total_votes: number;
  created_at: string;
};

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://onspot.app';

/** The link people share. Opens the web vote page, or the app when installed. */
export function squadLink(code: string): string {
  return `${WEB_URL.replace(/\/$/, '')}/s/${code}`;
}

export async function createSquad(
  client: SupabaseClient,
  venueIds: string[],
  title: string,
): Promise<string> {
  return unwrap(
    await client.rpc('create_squad', {
      p_venue_ids: venueIds,
      p_title: title,
      p_closes_in_minutes: 180,
    }),
  ) as string;
}

export async function fetchSquad(
  client: SupabaseClient,
  code: string,
  guestKey: string | null,
): Promise<Squad | null> {
  return unwrap(
    await client.rpc('get_squad', { p_code: code, p_guest_key: guestKey }),
  ) as Squad | null;
}

export async function castVote(
  client: SupabaseClient,
  code: string,
  optionId: string,
  guest: { key: string; name: string } | null,
) {
  unwrap(
    await client.rpc('cast_vote', {
      p_code: code,
      p_option_id: optionId,
      p_guest_key: guest?.key ?? null,
      p_guest_name: guest?.name ?? null,
    }),
  );
}

export async function fetchMySquads(client: SupabaseClient): Promise<SquadSummary[]> {
  return (unwrap(await client.rpc('my_squads')) as SquadSummary[] | null) ?? [];
}

const GUEST_KEY = 'onspot.guestKey';
const GUEST_NAME = 'onspot.guestName';

/** A random key that lets a guest (no account) change their vote later on this device. */
export async function getGuestKey(): Promise<string> {
  const existing = await AsyncStorage.getItem(GUEST_KEY);
  if (existing) return existing;
  const key = Crypto.randomUUID();
  await AsyncStorage.setItem(GUEST_KEY, key);
  return key;
}

export async function getGuestName(): Promise<string> {
  return (await AsyncStorage.getItem(GUEST_NAME)) ?? '';
}

export async function setGuestName(name: string) {
  await AsyncStorage.setItem(GUEST_NAME, name.trim());
}

/** Leading option, or null when nobody has voted or it's a tie at the top. */
export function leadingOption(options: SquadOption[]): SquadOption | null {
  const sorted = [...options].sort((a, b) => b.votes - a.votes);
  const [first, second] = sorted;
  if (!first || first.votes === 0) return null;
  if (second && second.votes === first.votes) return null;
  return first;
}

export function votePercent(votes: number, total: number): number {
  return total > 0 ? Math.round((votes / total) * 100) : 0;
}

export function closesInText(closesAt: string, now: Date = new Date()): string {
  const mins = Math.round((new Date(closesAt).getTime() - now.getTime()) / 60_000);
  if (mins <= 0) return 'Voting closed';
  if (mins < 60) return `Closes in ${mins} min`;
  return `Closes in ${Math.floor(mins / 60)} h ${mins % 60} min`;
}
