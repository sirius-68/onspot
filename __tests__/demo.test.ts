import { EMPTY_FILTERS } from '@/features/map/filters';
import { demoVenueDetail, demoVenues, distanceM, resetDemo, searchDemoVenues } from '@/lib/demo';

const here = { lat: 6.4281, lng: 3.4219 };

describe('demo mode', () => {
  beforeEach(() => resetDemo());

  it('places sample venues around you, nearest first', () => {
    const venues = demoVenues(here);
    expect(venues.length).toBe(12);
    expect(venues[0]!.distance_m).toBeLessThanOrEqual(venues[1]!.distance_m);
    expect(venues.every((v) => v.distance_m < 1000)).toBe(true);
  });

  it('keeps venues anchored as you move', () => {
    const first = demoVenues(here)[0]!;
    const moved = demoVenues({ lat: here.lat + 0.001, lng: here.lng }).find(
      (v) => v.id === first.id,
    )!;
    expect(moved.lat).toBe(first.lat);
  });

  it('filters like the real search', () => {
    expect(
      searchDemoVenues(here, { ...EMPTY_FILTERS, categories: ['club'] }).every(
        (v) => v.category === 'club',
      ),
    ).toBe(true);
    expect(
      searchDemoVenues(here, { ...EMPTY_FILTERS, maxPrice: 1 }).every(
        (v) => (v.price_band ?? 0) <= 1,
      ),
    ).toBe(true);
    expect(searchDemoVenues(here, { ...EMPTY_FILTERS, query: 'afro' }).map((v) => v.name)).toEqual([
      'Afro Heat Club',
    ]);
    expect(searchDemoVenues(here, { ...EMPTY_FILTERS, tonightOnly: true }).length).toBe(4);
  });

  it('builds a venue page with tonight’s event', () => {
    demoVenues(here);
    const detail = demoVenueDetail('demo-3')!;
    expect(detail.name).toBe('Afro Heat Club');
    expect(detail.events[0]?.title).toBe('Afro Fridays');
    expect(demoVenueDetail('demo-99')).toBeNull();
  });

  it('measures distance in metres', () => {
    expect(Math.round(distanceM({ lat: 0, lng: 0 }, { lat: 0.001, lng: 0 }))).toBe(111);
  });
});
