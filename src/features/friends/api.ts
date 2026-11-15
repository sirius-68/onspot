import type { SupabaseClient } from '@supabase/supabase-js';

import { unwrap } from '@/lib/errors';

export type FriendRow = {
  request_id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  state: 'friend' | 'incoming' | 'outgoing';
};

export type FriendLocation = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  lat: number;
  lng: number;
  updated_at: string;
};

export async function fetchFriends(client: SupabaseClient): Promise<FriendRow[]> {
  return (unwrap(await client.rpc('my_friends')) as FriendRow[] | null) ?? [];
}

export async function sendFriendRequest(client: SupabaseClient, username: string): Promise<string> {
  return unwrap(await client.rpc('send_friend_request', { p_username: username })) as string;
}

export async function respondFriendRequest(
  client: SupabaseClient,
  requestId: string,
  accept: boolean,
) {
  unwrap(await client.rpc('respond_friend_request', { p_request_id: requestId, p_accept: accept }));
}

export async function removeFriend(client: SupabaseClient, userId: string) {
  unwrap(await client.rpc('remove_friend', { p_user_id: userId }));
}

export async function blockUser(client: SupabaseClient, userId: string) {
  unwrap(await client.rpc('block_user', { p_user_id: userId }));
}

export async function fetchFriendLocations(client: SupabaseClient): Promise<FriendLocation[]> {
  return (unwrap(await client.rpc('friends_locations')) as FriendLocation[] | null) ?? [];
}

export async function shareMyLocation(
  client: SupabaseClient,
  lat: number,
  lng: number,
  accuracyM: number,
) {
  unwrap(
    await client.rpc('update_my_location', { p_lat: lat, p_lng: lng, p_accuracy_m: accuracyM }),
  );
}

export async function setGhostMode(client: SupabaseClient, on: boolean) {
  unwrap(await client.rpc('set_ghost_mode', { p_on: on }));
}

/** Friendly label for the result of a friend request. */
export function friendRequestResultText(result: string): string {
  switch (result) {
    case 'requested':
      return 'Request sent.';
    case 'accepted':
      return 'You’re now friends.';
    case 'already_friends':
      return 'You’re already friends.';
    case 'already_requested':
      return 'Request already sent.';
    default:
      return 'Done.';
  }
}
