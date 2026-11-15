import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

import type { VenueCategory } from './types';

export type CapacityLevel = 'quiet' | 'busy' | 'packed';

export type VenueEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  price_text: string | null;
  ticket_url: string | null;
  spots_left: number | null;
};

export type VenueDetail = {
  id: string;
  name: string;
  category: VenueCategory;
  address: string | null;
  cover_photo_url: string | null;
  price_band: number | null;
  music_tags: string[];
  lat: number;
  lng: number;
  vibe_score: number;
  is_host: boolean;
  status: {
    capacity_level: CapacityLevel;
    queue_minutes: number | null;
    updated_at: string;
  } | null;
  events: VenueEvent[];
};

export const venueKey = (id: string) => ['venue', id] as const;

export function useVenue(id: string | null) {
  return useQuery({
    queryKey: venueKey(id ?? ''),
    queryFn: async () => {
      const data = unwrap(
        await supabase.rpc('get_venue', { p_venue_id: id }),
      ) as VenueDetail | null;
      if (!data) throw new Error('Venue not found');
      return data;
    },
    enabled: !!id,
    refetchInterval: 120_000,
  });
}
