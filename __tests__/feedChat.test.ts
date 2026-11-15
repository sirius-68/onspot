import { formatMoney, parseAmount, previewText, type ConversationRow } from '@/features/chat/api';
import { withSeparators } from '@/features/chat/ChatScreen';
import { buildPosts, buildStories, type FeedRow, timeAgo } from '@/features/feed/api';
import { demoVenues, resetDemo } from '@/lib/demo';
import { DemoBackend } from '@/lib/demoBackend';

jest.mock('expo-file-system', () => ({ File: class {}, Paths: {} }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

const now = new Date('2026-11-16T23:00:00Z');
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

function row(over: Partial<FeedRow>): FeedRow {
  return {
    clip_id: 'c1',
    venue_id: 'v1',
    venue_name: 'Neon Basement',
    venue_cover_url: null,
    author_id: 'u1',
    username: 'amara',
    display_name: 'Amara',
    avatar_url: null,
    storage_path: 'v1/c1.mp4',
    published_at: minsAgo(5),
    reactions: 2,
    i_reacted: false,
    ...over,
  };
}

describe('feed grouping', () => {
  const rows = [
    row({ clip_id: 'a1', published_at: minsAgo(5) }),
    row({ clip_id: 'a2', published_at: minsAgo(20) }),
    row({ clip_id: 'a3', venue_id: 'v2', venue_name: 'Rooftop 9', published_at: minsAgo(200) }),
    row({
      clip_id: 'b1',
      author_id: 'u2',
      display_name: 'Tunde',
      published_at: minsAgo(10),
      reactions: 5,
      i_reacted: true,
    }),
  ];

  it('makes stories from the last hour, newest person first, clips in play order', () => {
    const stories = buildStories(rows, now);
    expect(stories.map((s) => s.name)).toEqual(['Amara', 'Tunde']);
    expect(stories[0]!.clips.map((c) => c.clip_id)).toEqual(['a2', 'a1']);
  });

  it('groups posts by person and venue and adds up fires', () => {
    const posts = buildPosts(rows);
    expect(posts.map((p) => `${p.name}@${p.venueName}`)).toEqual([
      'Amara@Neon Basement',
      'Tunde@Neon Basement',
      'Amara@Rooftop 9',
    ]);
    expect(posts[0]!.reactions).toBe(4);
    expect(posts[1]!.iReacted).toBe(true);
  });

  it('formats compact times', () => {
    expect(timeAgo(minsAgo(0), now)).toBe('now');
    expect(timeAgo(minsAgo(7), now)).toBe('7m');
    expect(timeAgo(minsAgo(130), now)).toBe('2h');
    expect(timeAgo(minsAgo(60 * 50), now)).toBe('2d');
  });
});

describe('chat helpers', () => {
  it('parses amounts into pence', () => {
    expect(parseAmount('15')).toBe(1500);
    expect(parseAmount('£12.50')).toBe(1250);
    expect(parseAmount('7,5')).toBe(750);
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('200000')).toBeNull();
  });

  it('formats money', () => {
    expect(formatMoney(1500, 'GBP')).toMatch(/15/);
    expect(formatMoney(1250, 'GBP')).toMatch(/12\.50/);
  });

  it('previews the last message', () => {
    const base = { last_amount_minor: 1500, last_currency: 'GBP' } as ConversationRow;
    expect(previewText({ ...base, last_kind: null })).toBe('Say hi 👋');
    expect(previewText({ ...base, last_kind: 'split', last_sender_is_me: false })).toMatch(
      /^Asked you for/,
    );
    expect(
      previewText({ ...base, last_kind: 'text', last_body: 'yo', last_sender_is_me: true }),
    ).toBe('You: yo');
  });

  it('adds a time separator when an hour passes', () => {
    const msg = (id: string, sender: string, at: string) => ({
      id,
      sender_id: sender,
      kind: 'text' as const,
      body: id,
      amount_minor: null,
      currency: null,
      paid_at: null,
      created_at: at,
    });
    const items = withSeparators(
      [
        msg('m1', 'them', minsAgo(300)),
        msg('m2', 'them', minsAgo(299)),
        msg('m3', 'me', minsAgo(5)),
      ],
      'me',
    );
    expect(items.map((i) => i.type)).toEqual([
      'separator',
      'message',
      'message',
      'separator',
      'message',
    ]);
    const last = items[items.length - 1];
    expect(last?.type === 'message' && last.mine).toBe(true);
  });
});

describe('demo backend: feed, chats, plans', () => {
  function setup() {
    resetDemo();
    demoVenues({ lat: 6.43, lng: 3.42 });
    const store = new Map<string, string>();
    let clock = now.getTime();
    const backend = new DemoBackend(
      {
        getItem: async (k) => store.get(k) ?? null,
        setItem: async (k, v) => {
          store.set(k, v);
        },
        removeItem: async (k) => {
          store.delete(k);
        },
      },
      () => new Date(clock),
    );
    return { client: backend.asClient(), tick: (ms: number) => (clock += ms) };
  }

  it('shows friends’ posts with photos and toggles fires', async () => {
    const { client } = setup();
    const feed = (await client.rpc('friends_feed')).data as FeedRow[];
    const authors = new Set(feed.map((r) => r.username));
    expect(authors.has('amara')).toBe(true);
    expect(authors.has('leo')).toBe(false); // not a friend
    const first = feed[0]!;
    expect(client.storage.from('clips').getPublicUrl(first.storage_path).data.publicUrl).toMatch(
      /^https:\/\/images\.pexels\.com/,
    );
    const after = (await client.rpc('toggle_reaction', { p_clip_id: first.clip_id })).data;
    expect(after).toBe(first.reactions + 1);
  });

  it('chats: friend replies a moment later, splits get marked paid', async () => {
    const { client, tick } = setup();
    const list = (await client.rpc('my_conversations')).data as ConversationRow[];
    expect(list[0]?.username).toBe('amara');
    const id = list[0]!.conversation_id;
    const before = (
      (await client.rpc('conversation_messages', { p_conversation_id: id })).data as unknown[]
    ).length;
    await client.rpc('send_message', { p_conversation_id: id, p_body: 'See you at 11' });
    const right = (await client.rpc('conversation_messages', { p_conversation_id: id }))
      .data as unknown[];
    expect(right.length).toBe(before + 1);
    tick(3000);
    const later = (await client.rpc('conversation_messages', { p_conversation_id: id }))
      .data as unknown[];
    expect(later.length).toBe(before + 2);

    const msgs = later as { id: string; kind: string; sender_id: string; paid_at: string | null }[];
    const request = msgs.find((m) => m.kind === 'split' && m.sender_id !== 'demo-user')!;
    await client.rpc('mark_split_paid', { p_message_id: request.id });
    const paid = (
      (await client.rpc('conversation_messages', { p_conversation_id: id })).data as typeof msgs
    ).find((m) => m.id === request.id);
    expect(paid?.paid_at).not.toBeNull();

    const err = await client.rpc('send_split_request', {
      p_conversation_id: id,
      p_amount_minor: 0,
      p_currency: 'GBP',
    });
    expect(err.error?.message).toBe('invalid_amount');
  });

  it('only friends can be messaged', async () => {
    const { client } = setup();
    expect(
      (await client.rpc('open_direct_conversation', { p_user_id: 'demo-leo' })).error?.message,
    ).toBe('friends_only');
    expect((await client.rpc('open_direct_conversation', { p_user_id: 'demo-tunde' })).data).toBe(
      'chat-tunde',
    );
  });

  it('lists tonight’s events with tickets and spots', async () => {
    const { client } = setup();
    const events = (
      await client.rpc('events_tonight', { origin_lat: 6.43, origin_lng: 3.42, radius_m: 5000 })
    ).data as { title: string; ticket_url: string | null; spots_left: number | null }[];
    expect(events.map((e) => e.title)).toContain('Afro Fridays');
    expect(events.find((e) => e.title === 'Afro Fridays')?.ticket_url).toBe('demo:tickets');
  });
});
