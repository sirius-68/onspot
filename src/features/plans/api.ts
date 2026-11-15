import type { SupabaseClient } from '@supabase/supabase-js';

import type { LatLng } from '@/features/venues/types';
import { unwrap } from '@/lib/errors';

/** A row from the `events_tonight` RPC. */
export type TonightEvent = {
  event_id: string;
  venue_id: string;
  venue_name: string;
  category: string;
  cover_photo_url: string | null;
  title: string;
  starts_at: string;
  ends_at: string | null;
  price_text: string | null;
  ticket_url: string | null;
  spots_left: number | null;
  distance_m: number;
  lat: number;
  lng: number;
};

export async function fetchEventsTonight(
  client: SupabaseClient,
  center: LatLng,
  radiusM = 5000,
): Promise<TonightEvent[]> {
  return (
    (unwrap(
      await client.rpc('events_tonight', {
        origin_lat: center.lat,
        origin_lng: center.lng,
        radius_m: radiusM,
      }),
    ) as TonightEvent[] | null) ?? []
  );
}
