import { pickPhotoPinVenues, venuesToFeatureCollection } from '@/features/map/geo';

import { makeVenue } from './helpers/fixtures';

describe('map geo helpers', () => {
  it('builds GeoJSON points in [lng, lat] order', () => {
    const fc = venuesToFeatureCollection([makeVenue({ id: 'a', lat: 1, lng: 2 })]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]?.geometry.coordinates).toEqual([2, 1]);
    expect(fc.features[0]?.properties).toEqual({ id: 'a', name: 'Neon Basement' });
  });

  it('gives photo pins only to the nearest venues', () => {
    const venues = [
      makeVenue({ id: 'far', distance_m: 900 }),
      makeVenue({ id: 'near', distance_m: 50 }),
      makeVenue({ id: 'mid', distance_m: 300 }),
    ];
    expect(pickPhotoPinVenues(venues, 2).map((v) => v.id)).toEqual(['near', 'mid']);
    // does not reorder the caller's array
    expect(venues[0]?.id).toBe('far');
  });
});
