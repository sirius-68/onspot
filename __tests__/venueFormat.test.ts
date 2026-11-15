import {
  categoryLabel,
  formatDistance,
  formatPriceBand,
  formatWalkTime,
  venueInitials,
} from '@/features/venues/format';

describe('venue formatting', () => {
  it('labels categories', () => {
    expect(categoryLabel('live_music')).toBe('Live music');
    expect(categoryLabel('club')).toBe('Club');
  });

  it('formats distances', () => {
    expect(formatDistance(4)).toBe('10 m');
    expect(formatDistance(243)).toBe('240 m');
    expect(formatDistance(1530)).toBe('1.5 km');
    expect(formatDistance(-1)).toBe('');
  });

  it('formats walking time', () => {
    expect(formatWalkTime(20)).toBe('1 min walk');
    expect(formatWalkTime(800)).toBe('10 min walk');
  });

  it('formats price bands', () => {
    expect(formatPriceBand(3)).toBe('£££');
    expect(formatPriceBand(null)).toBe('');
    expect(formatPriceBand(7)).toBe('');
    expect(formatPriceBand(2, '₦')).toBe('₦₦');
  });

  it('makes initials', () => {
    expect(venueInitials('Neon Basement')).toBe('NB');
    expect(venueInitials('Rooftop 9')).toBe('R9');
    expect(venueInitials('Ozone')).toBe('OZ');
    expect(venueInitials('   ')).toBe('?');
  });
});
