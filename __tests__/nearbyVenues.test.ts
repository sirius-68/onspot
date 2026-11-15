import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchNearbyVenues, roundCenter } from '@/features/map/useNearbyVenues';

import { makeVenue } from './helpers/fixtures';

function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const rpc = jest.fn().mockResolvedValue(result);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe('fetchNearbyVenues', () => {
  it('calls the venues_near RPC with the origin and radius', async () => {
    const { client, rpc } = fakeClient({ data: [makeVenue()], error: null });
    const venues = await fetchNearbyVenues(client, { lat: 51.5, lng: -0.07 }, 2000);
    expect(rpc).toHaveBeenCalledWith('venues_near', {
      origin_lat: 51.5,
      origin_lng: -0.07,
      radius_m: 2000,
    });
    expect(venues).toHaveLength(1);
  });

  it('returns an empty list when there are no rows', async () => {
    const { client } = fakeClient({ data: null, error: null });
    await expect(fetchNearbyVenues(client, { lat: 0, lng: 0 })).resolves.toEqual([]);
  });

  it('throws a readable error', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'boom' } });
    await expect(fetchNearbyVenues(client, { lat: 0, lng: 0 })).rejects.toThrow(
      'Could not load venues: boom',
    );
  });
});

describe('roundCenter', () => {
  it('rounds to three decimals so GPS jitter keeps the same query key', () => {
    expect(roundCenter({ lat: 51.52463, lng: -0.07814 })).toEqual({ lat: 51.525, lng: -0.078 });
  });
});
