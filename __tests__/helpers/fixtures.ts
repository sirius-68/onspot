import type { NearbyVenue } from '@/features/venues/types';

export function makeVenue(overrides: Partial<NearbyVenue> = {}): NearbyVenue {
  return {
    id: 'v1',
    name: 'Neon Basement',
    category: 'club',
    lat: 51.5263,
    lng: -0.0779,
    distance_m: 240,
    address: 'Sample St 1',
    cover_photo_url: null,
    price_band: 3,
    music_tags: ['house', 'techno'],
    ...overrides,
  };
}
