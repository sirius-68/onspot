// Demo mode: when the Supabase keys aren't set, the app shows sample venues placed around
// wherever you are, so the whole app can be tried on a phone before the backend exists.
// Nothing here is real data. The rest of the local backend lives in demoBackend.ts.

import type { VenueFilters } from '@/features/map/filters';
import type { LatLng, NearbyVenue, VenueCategory } from '@/features/venues/types';
import type { CapacityLevel, VenueDetail } from '@/features/venues/useVenue';

type DemoEvent = VenueDetail['events'][number];

/** Changes made while using the demo (host updates, posted clips), layered over the seeds. */
export type DemoOverlay = {
  /** Clips posted in the last 60 minutes, per venue. */
  liveClips?: Record<string, number>;
  status?: Record<
    string,
    { capacity_level: CapacityLevel; queue_minutes: number; updated_at: string }
  >;
  events?: Record<string, DemoEvent[]>;
  hosted?: string[];
};

type DemoSeed = {
  name: string;
  category: VenueCategory;
  dLat: number;
  dLng: number;
  price: number;
  tags: string[];
  live: number;
  vibe: number;
  capacity: 'quiet' | 'busy' | 'packed' | null;
  event?: { title: string; inHours: number; price: string; spots: number | null };
};

const SEEDS: DemoSeed[] = [
  {
    name: 'Neon Basement',
    category: 'club',
    dLat: 0.0017,
    dLng: 0.0002,
    price: 3,
    tags: ['house', 'techno'],
    live: 3,
    vibe: 78,
    capacity: 'packed',
    event: { title: 'Deep House Night', inHours: 1, price: '£15', spots: 12 },
  },
  {
    name: 'The Velvet Room',
    category: 'lounge',
    dLat: 0.0003,
    dLng: -0.0014,
    price: 3,
    tags: ['rnb', 'soul'],
    live: 1,
    vibe: 34,
    capacity: 'busy',
  },
  {
    name: 'Afro Heat Club',
    category: 'club',
    dLat: -0.0014,
    dLng: 0.0015,
    price: 2,
    tags: ['afrobeats', 'amapiano'],
    live: 4,
    vibe: 91,
    capacity: 'packed',
    event: { title: 'Afro Fridays', inHours: 0.5, price: '£10 before 11', spots: 40 },
  },
  {
    name: 'Corner Pint',
    category: 'bar',
    dLat: -0.0005,
    dLng: 0.0029,
    price: 1,
    tags: ['indie'],
    live: 0,
    vibe: 8,
    capacity: 'quiet',
  },
  {
    name: 'Rooftop 9',
    category: 'bar',
    dLat: 0.0012,
    dLng: -0.0031,
    price: 3,
    tags: ['disco', 'house'],
    live: 2,
    vibe: 52,
    capacity: 'busy',
  },
  {
    name: 'Low Light Jazz',
    category: 'live_music',
    dLat: -0.0021,
    dLng: -0.0017,
    price: 2,
    tags: ['jazz'],
    live: 1,
    vibe: 27,
    capacity: null,
    event: { title: 'Late Jazz Session', inHours: 0.25, price: 'Free entry', spots: null },
  },
  {
    name: 'Warehouse Sundays',
    category: 'day_party',
    dLat: 0.0033,
    dLng: 0.0036,
    price: 2,
    tags: ['house', 'garage'],
    live: 0,
    vibe: 0,
    capacity: null,
    event: { title: 'Garage Classics', inHours: 3, price: '£12', spots: 0 },
  },
  {
    name: 'Pop-Up Garden',
    category: 'pop_up',
    dLat: -0.0029,
    dLng: 0.005,
    price: 1,
    tags: ['hiphop'],
    live: 0,
    vibe: 5,
    capacity: 'quiet',
  },
  {
    name: 'Bassline Arches',
    category: 'club',
    dLat: 0.0025,
    dLng: -0.0047,
    price: 2,
    tags: ['dnb', 'garage'],
    live: 2,
    vibe: 61,
    capacity: 'busy',
  },
  {
    name: 'Little Karaoke',
    category: 'bar',
    dLat: -0.001,
    dLng: -0.004,
    price: 1,
    tags: ['pop'],
    live: 0,
    vibe: 12,
    capacity: null,
  },
  {
    name: 'Gold Tooth Lounge',
    category: 'lounge',
    dLat: 0.0008,
    dLng: 0.0043,
    price: 4,
    tags: ['hiphop', 'rnb'],
    live: 1,
    vibe: 44,
    capacity: 'busy',
  },
  {
    name: 'Late Kitchen Disco',
    category: 'club',
    dLat: -0.0034,
    dLng: 0.0002,
    price: 2,
    tags: ['disco'],
    live: 0,
    vibe: 15,
    capacity: null,
  },
];

/** Metres between two points (haversine). */
export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// The demo venues are anchored once (first centre seen) so they don't move as you walk.
let anchor: LatLng | null = null;

function anchored(center: LatLng): LatLng {
  if (!anchor) anchor = center;
  return anchor;
}

/** Resets the anchor (tests). */
export function resetDemo() {
  anchor = null;
}

export function demoAnchor(): LatLng | null {
  return anchor;
}

export function demoVenueName(id: string): string | null {
  return SEEDS[Number(id.replace('demo-', '')) - 1]?.name ?? null;
}

export function demoVenueIds(): string[] {
  return SEEDS.map((_, i) => `demo-${i + 1}`);
}

export function demoVenueSeed(id: string) {
  return SEEDS[Number(id.replace('demo-', '')) - 1] ?? null;
}

export function demoVenues(center: LatLng, overlay: DemoOverlay = {}): NearbyVenue[] {
  const a = anchored(center);
  return SEEDS.map((s, i) => {
    const id = `demo-${i + 1}`;
    const lat = a.lat + s.dLat;
    const lng = a.lng + s.dLng;
    const posted = overlay.liveClips?.[id] ?? 0;
    return {
      id,
      name: s.name,
      category: s.category,
      lat,
      lng,
      distance_m: distanceM(center, { lat, lng }),
      address: 'Sample venue (demo mode)',
      cover_photo_url: null,
      price_band: s.price,
      music_tags: s.tags,
      vibe_score: Math.min(100, s.vibe + posted * 10),
      live_clip_count: s.live + posted,
      capacity_level: overlay.status?.[id]?.capacity_level ?? s.capacity,
    };
  }).sort((x, y) => x.distance_m - y.distance_m);
}

/** Same filtering as the search_venues database function, done on the phone. */
export function searchDemoVenues(
  center: LatLng,
  filters: VenueFilters,
  radiusM = 3000,
  overlay: DemoOverlay = {},
): NearbyVenue[] {
  const q = filters.query.trim().toLowerCase();
  return demoVenues(center, overlay).filter((v) => {
    const seed = demoVenueSeed(v.id);
    const hasEvent = !!seed?.event || (overlay.events?.[v.id]?.length ?? 0) > 0;
    if (v.distance_m > radiusM) return false;
    if (
      q &&
      !(
        v.name.toLowerCase().includes(q) ||
        v.category.includes(q) ||
        v.music_tags.some((t) => t.includes(q))
      )
    )
      return false;
    if (filters.categories.length > 0 && !filters.categories.includes(v.category)) return false;
    if (filters.maxPrice !== null && v.price_band !== null && v.price_band > filters.maxPrice)
      return false;
    if (filters.tonightOnly && !hasEvent) return false;
    return true;
  });
}

export function demoVenueDetail(
  id: string,
  now: Date = new Date(),
  overlay: DemoOverlay = {},
): VenueDetail | null {
  const index = Number(id.replace('demo-', '')) - 1;
  const seed = SEEDS[index];
  const a = anchor;
  if (!seed || !a) return null;
  const start = new Date(now.getTime() + (seed.event?.inHours ?? 0) * 3600_000);
  return {
    id,
    name: seed.name,
    category: seed.category,
    address: 'Sample venue (demo mode)',
    cover_photo_url: null,
    price_band: seed.price,
    music_tags: seed.tags,
    lat: a.lat + seed.dLat,
    lng: a.lng + seed.dLng,
    vibe_score: Math.min(100, seed.vibe + (overlay.liveClips?.[id] ?? 0) * 10),
    is_host: overlay.hosted?.includes(id) ?? false,
    status: overlay.status?.[id]
      ? overlay.status[id]
      : seed.capacity
        ? {
            capacity_level: seed.capacity,
            queue_minutes: seed.capacity === 'packed' ? 20 : 5,
            updated_at: now.toISOString(),
          }
        : null,
    events: [
      ...(overlay.events?.[id] ?? []),
      ...(seed.event
        ? [
            {
              id: `${id}-event`,
              title: seed.event.title,
              starts_at: start.toISOString(),
              ends_at: new Date(start.getTime() + 5 * 3600_000).toISOString(),
              price_text: seed.event.price,
              ticket_url: null,
              spots_left: seed.event.spots,
            },
          ]
        : []),
    ].sort((x, y) => x.starts_at.localeCompare(y.starts_at)),
  };
}
