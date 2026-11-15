import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { unwrap } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { LatLng, NearbyVenue } from '@/features/venues/types';

import { toSearchParams, type VenueFilters } from './filters';
import { DEFAULT_RADIUS_M, roundCenter } from './useNearbyVenues';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Venues near the centre matching the filters. Text search is debounced. */
export function useVenueSearch(
  center: LatLng | null,
  filters: VenueFilters,
  radiusM = DEFAULT_RADIUS_M,
) {
  const query = useDebounced(filters.query, 300);
  const key = center ? roundCenter(center) : null;
  const f = { ...filters, query };
  return useQuery({
    queryKey: ['venue-search', key?.lat, key?.lng, radiusM, f],
    queryFn: async () =>
      (unwrap(await supabase.rpc('search_venues', toSearchParams(key as LatLng, radiusM, f))) as
        NearbyVenue[] | null) ?? [],
    enabled: key !== null,
    placeholderData: keepPreviousData,
    refetchInterval: 120_000,
  });
}
