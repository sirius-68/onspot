import { postClip } from '@/features/clips/api';
import { castVote, createSquad, fetchMySquads, fetchSquad } from '@/features/squads/api';
import { demoVenues, resetDemo } from '@/lib/demo';
import { DemoBackend, initialDemoState } from '@/lib/demoBackend';

jest.mock('expo-file-system', () => ({ File: class {}, Paths: {} }));

const here = { lat: 6.4281, lng: 3.4219 };

function memoryStore() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k: string) => data.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: async (k: string) => {
      data.delete(k);
    },
  };
}

function setup(now = new Date('2026-11-16T22:00:00Z')) {
  resetDemo();
  demoVenues(here);
  const store = memoryStore();
  const writes: string[] = [];
  const backend = new DemoBackend(
    store,
    () => now,
    async (path) => {
      writes.push(path);
      return `file:///demo/${path}`;
    },
  );
  return { backend, client: backend.asClient(), store, writes };
}

describe('demo backend', () => {
  it('signs you in as a guest with every tool', async () => {
    const { client } = setup();
    const { data } = await client.auth.getSession();
    expect(data.session?.user.is_anonymous).toBe(false);
    const profile = await client.rpc('my_profile');
    expect(profile.data).toEqual([expect.objectContaining({ username: 'guest', role: 'admin' })]);
  });

  it('posts a clip that shows up live and lifts the venue', async () => {
    const { client, writes } = setup();
    const { clipId } = await postClip(
      'demo-2',
      {
        uri: 'file:///tmp/clip.mp4',
        durationS: 8,
        capturedAt: new Date(),
        lat: here.lat,
        lng: here.lng,
        accuracyM: 10,
      },
      { client, readFile: async () => new ArrayBuffer(4) },
    );
    expect(writes).toHaveLength(1);
    const live = await client.rpc('venue_live_clips', { p_venue_id: 'demo-2' });
    expect((live.data as { id: string }[]).map((c) => c.id)).toEqual([clipId]);
    const venues = await client.rpc('search_venues', {
      origin_lat: here.lat,
      origin_lng: here.lng,
      radius_m: 3000,
      p_query: 'velvet',
    });
    expect((venues.data as { live_clip_count: number }[])[0]?.live_clip_count).toBe(1);
    expect(
      client.storage.from('clips').getPublicUrl(`demo-2/${clipId}.mp4`).data.publicUrl,
    ).toMatch(/^file:/);
  });

  it('runs a squad vote with friends already voting', async () => {
    const { client } = setup();
    const code = await createSquad(client, ['demo-1', 'demo-3'], 'Friday');
    const squad = await fetchSquad(client, code, null);
    expect(squad?.total_votes).toBe(2);
    await castVote(client, code, squad!.options[1]!.option_id, null);
    const after = await fetchSquad(client, code, null);
    expect(after?.my_option_id).toBe(squad!.options[1]!.option_id);
    expect(after?.options[1]?.votes).toBe(2);
    expect((await fetchMySquads(client))[0]?.code).toBe(code);
    await expect(createSquad(client, ['demo-1'], 'x')).rejects.toThrow('pick_2_or_3_venues');
  });

  it('lets the guest host update status and add an event', async () => {
    const { client } = setup();
    await client.rpc('set_venue_status', {
      p_venue_id: 'demo-1',
      p_capacity_level: 'quiet',
      p_queue_minutes: 0,
    });
    await client.rpc('host_upsert_event', {
      p_venue_id: 'demo-1',
      p_title: 'Secret set',
      p_starts_at: '2026-11-16T23:00:00Z',
      p_ends_at: '2026-11-17T03:00:00Z',
      p_price_text: '£5',
      p_ticket_url: null,
      p_spots_left: 20,
    });
    const venue = (await client.rpc('get_venue', { p_venue_id: 'demo-1' })).data as {
      is_host: boolean;
      status: { capacity_level: string };
      events: { title: string }[];
    };
    expect(venue.is_host).toBe(true);
    expect(venue.status.capacity_level).toBe('quiet');
    expect(venue.events.map((e) => e.title)).toContain('Secret set');
    const denied = await client.rpc('set_venue_status', { p_venue_id: 'demo-2' });
    expect(denied.error?.message).toBe('not_venue_host');
  });

  it('handles friends: accept, request, locations', async () => {
    const { client } = setup();
    expect((await client.rpc('send_friend_request', { p_username: 'zoe' })).data).toBe('accepted');
    expect((await client.rpc('send_friend_request', { p_username: 'leo' })).data).toBe('requested');
    expect((await client.rpc('send_friend_request', { p_username: 'nobody' })).error?.message).toBe(
      'unknown_user',
    );
    const locations = (await client.rpc('friends_locations')).data as { username: string }[];
    expect(locations.map((l) => l.username).sort()).toEqual(['amara', 'tunde', 'zoe']);
  });

  it('keeps data between launches and resets on sign out', async () => {
    const { client, store } = setup();
    await client.rpc('set_ghost_mode', { p_on: true });
    const relaunched = new DemoBackend(store, () => new Date()).asClient();
    expect(
      ((await relaunched.rpc('my_profile')).data as { ghost_mode: boolean }[])[0]?.ghost_mode,
    ).toBe(true);
    await relaunched.auth.signOut();
    expect(
      ((await relaunched.rpc('my_profile')).data as { ghost_mode: boolean }[])[0]?.ghost_mode,
    ).toBe(initialDemoState().profile.ghost_mode);
  });

  it('computes admin metrics and refuses unknown calls', async () => {
    const { client } = setup();
    const metrics = (await client.rpc('admin_metrics')).data as Record<string, unknown>;
    expect(metrics.venues).toBe(12);
    expect((await client.rpc('nope')).error?.message).toMatch(/demo_mode/);
  });
});
