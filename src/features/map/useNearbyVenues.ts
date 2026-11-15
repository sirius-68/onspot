import type { SupabaseClient } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { LatLng, NearbyVenue } from '@/features/venues/types';

export const DEFAULT_RADIUS_M = 3000;

export async function fetchNearbyVenues(
  client: SupabaseClient,
  center: LatLng,
  radiusM: number = DEFAULT_RADIUS_M,
): Promise<NearbyVenue[]> {
  const { data, error } = await client.rpc('venues_near', {
    origin_lat: center.lat,
    origin_lng: center.lng,
    radius_m: radiusM,
  });
  if (error) throw new Error(`Could not load venues: ${error.message}`);
  return (data ?? []) as NearbyVenue[];
}

/** Rounds to ~110 m so small GPS jitter doesn't refetch the map. */
export function roundCenter(center: LatLng): LatLng {
  return { lat: Math.round(center.lat * 1000) / 1000, lng: Math.round(center.lng * 1000) / 1000 };
}

export function useNearbyVenues(center: LatLng | null, radiusM: number = DEFAULT_RADIUS_M) {
  const key = center ? roundCenter(center) : null;
  return useQuery({
    queryKey: ['venues-near', key?.lat, key?.lng, radiusM],
    queryFn: () => fetchNearbyVenues(supabase, key as LatLng, radiusM),
    enabled: key !== null,
  });
}
