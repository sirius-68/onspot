import type { NearbyVenue } from '@/features/venues/types';

export type VenueFeatureProps = { id: string; name: string };

/** GeoJSON for the clustered venue layer. Map positions are [lng, lat]. */
export function venuesToFeatureCollection(
  venues: NearbyVenue[],
): GeoJSON.FeatureCollection<GeoJSON.Point, VenueFeatureProps> {
  return {
    type: 'FeatureCollection',
    features: venues.map((v) => ({
      type: 'Feature',
      id: v.id,
      geometry: { type: 'Point', coordinates: [v.lng, v.lat] },
      properties: { id: v.id, name: v.name },
    })),
  };
}

/**
 * Photo pins are React views (MarkerView) and get expensive in large numbers (debugging
 * list D12). Only the nearest `limit` venues get one; the rest stay in the cluster layer.
 */
export function pickPhotoPinVenues(venues: NearbyVenue[], limit = 60): NearbyVenue[] {
  return [...venues].sort((a, b) => a.distance_m - b.distance_m).slice(0, limit);
}

/** Zoom at which clusters break apart and photo pins take over. */
export const PHOTO_PIN_MIN_ZOOM = 14;
