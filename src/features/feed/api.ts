import type { SupabaseClient } from '@supabase/supabase-js';

import { unwrap } from '@/lib/errors';

/** A row from the `friends_feed` RPC: one live clip by you or a friend (last 24 h). */
export type FeedRow = {
  clip_id: string;
  venue_id: string;
  venue_name: string;
  venue_cover_url: string | null;
  author_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  storage_path: string;
  published_at: string;
  reactions: number;
  i_reacted: boolean;
};

export const feedKey = ['feed'] as const;

export async function fetchFeed(client: SupabaseClient): Promise<FeedRow[]> {
  return (unwrap(await client.rpc('friends_feed')) as FeedRow[] | null) ?? [];
}

export async function toggleReaction(client: SupabaseClient, clipId: string): Promise<number> {
  return unwrap(await client.rpc('toggle_reaction', { p_clip_id: clipId })) as number;
}

export type Story = {
  authorId: string;
  name: string;
  avatarUrl: string | null;
  /** Oldest first, the order they play in. */
  clips: FeedRow[];
  latest: string;
};

export type Post = {
  key: string;
  authorId: string;
  name: string;
  avatarUrl: string | null;
  venueId: string;
  venueName: string;
  venueCoverUrl: string | null;
  /** Newest first. */
  clips: FeedRow[];
  latest: string;
  reactions: number;
  iReacted: boolean;
};

const nameOf = (r: FeedRow) => r.display_name || r.username;

/** Stories: each person's clips from the last hour, people with the newest clip first. */
export function buildStories(rows: FeedRow[], now: Date = new Date(), windowMin = 60): Story[] {
  const cutoff = now.getTime() - windowMin * 60_000;
  const byAuthor = new Map<string, Story>();
  for (const r of rows) {
    if (Date.parse(r.published_at) <= cutoff) continue;
    const story = byAuthor.get(r.author_id) ?? {
      authorId: r.author_id,
      name: nameOf(r),
      avatarUrl: r.avatar_url,
      clips: [],
      latest: r.published_at,
    };
    story.clips.push(r);
    if (r.published_at > story.latest) story.latest = r.published_at;
    byAuthor.set(r.author_id, story);
  }
  return [...byAuthor.values()]
    .map((s) => ({
      ...s,
      clips: [...s.clips].sort((a, b) => a.published_at.localeCompare(b.published_at)),
    }))
    .sort((a, b) => b.latest.localeCompare(a.latest));
}

/** Posts: clips grouped by person and venue, newest post first. */
export function buildPosts(rows: FeedRow[]): Post[] {
  const byKey = new Map<string, Post>();
  for (const r of rows) {
    const key = `${r.author_id}:${r.venue_id}`;
    const post = byKey.get(key) ?? {
      key,
      authorId: r.author_id,
      name: nameOf(r),
      avatarUrl: r.avatar_url,
      venueId: r.venue_id,
      venueName: r.venue_name,
      venueCoverUrl: r.venue_cover_url,
      clips: [],
      latest: r.published_at,
      reactions: 0,
      iReacted: false,
    };
    post.clips.push(r);
    post.reactions += r.reactions;
    post.iReacted ||= r.i_reacted;
    if (r.published_at > post.latest) post.latest = r.published_at;
    byKey.set(key, post);
  }
  return [...byKey.values()]
    .map((p) => ({
      ...p,
      clips: [...p.clips].sort((a, b) => b.published_at.localeCompare(a.published_at)),
    }))
    .sort((a, b) => b.latest.localeCompare(a.latest));
}

/** "now", "5m", "2h", "3d" — the compact times from the references. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
