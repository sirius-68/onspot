import type { VenueCategory } from '@/features/venues/types';

export type VenueFilters = {
  query: string;
  categories: VenueCategory[];
  maxPrice: number | null;
  tonightOnly: boolean;
};

export const EMPTY_FILTERS: VenueFilters = {
  query: '',
  categories: [],
  maxPrice: null,
  tonightOnly: false,
};

export const CATEGORY_CHIPS: { key: VenueCategory; label: string }[] = [
  { key: 'club', label: 'Clubs' },
  { key: 'bar', label: 'Bars' },
  { key: 'lounge', label: 'Lounges' },
  { key: 'live_music', label: 'Live music' },
  { key: 'day_party', label: 'Day parties' },
];

export function toggleCategory(filters: VenueFilters, category: VenueCategory): VenueFilters {
  const has = filters.categories.includes(category);
  return {
    ...filters,
    categories: has
      ? filters.categories.filter((c) => c !== category)
      : [...filters.categories, category],
  };
}

export function hasActiveFilters(f: VenueFilters): boolean {
  return f.query.trim() !== '' || f.categories.length > 0 || f.maxPrice !== null || f.tonightOnly;
}

/** RPC params for search_venues. */
export function toSearchParams(
  center: { lat: number; lng: number },
  radiusM: number,
  f: VenueFilters,
) {
  return {
    origin_lat: center.lat,
    origin_lng: center.lng,
    radius_m: radiusM,
    p_query: f.query.trim() || null,
    p_categories: f.categories.length > 0 ? f.categories : null,
    p_max_price: f.maxPrice,
    p_music_tag: null,
    p_tonight_only: f.tonightOnly,
  };
}
