export type VenueCategory =
  'club' | 'bar' | 'lounge' | 'live_music' | 'day_party' | 'pop_up' | 'other';

/** A row returned by the `venues_near` RPC. */
export type NearbyVenue = {
  id: string;
  name: string;
  category: VenueCategory;
  lat: number;
  lng: number;
  distance_m: number;
  address: string | null;
  cover_photo_url: string | null;
  price_band: number | null;
  music_tags: string[];
  vibe_score?: number;
  live_clip_count?: number;
  capacity_level?: 'quiet' | 'busy' | 'packed' | null;
};

export type LatLng = { lat: number; lng: number };
