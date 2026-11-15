import {
  isAdult,
  isValidEmail,
  isValidUsername,
  parseBirthdate,
  toIsoDate,
} from '@/features/auth/validation';
import { friendRequestResultText } from '@/features/friends/api';
import { buildEventTimes, isValidTicketUrl, parseTime } from '@/features/host/eventForm';
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  toSearchParams,
  toggleCategory,
} from '@/features/map/filters';
import {
  closesInText,
  leadingOption,
  squadLink,
  votePercent,
  type SquadOption,
} from '@/features/squads/api';
import {
  capacityText,
  eventTimeText,
  queueText,
  spotsText,
  vibeText,
} from '@/features/venues/eventFormat';
import { directionsUrl } from '@/lib/directions';
import { errorText } from '@/lib/errors';

describe('age and identity', () => {
  it('parses DD/MM/YYYY and rejects impossible dates', () => {
    expect(toIsoDate(parseBirthdate('05/03/1999') as Date)).toBe('1999-03-05');
    expect(parseBirthdate('31/02/1999')).toBeNull();
    expect(parseBirthdate('1999-03-05')).toBeNull();
  });
  it('checks 18+ to the day', () => {
    const now = new Date('2026-11-16T12:00:00Z');
    expect(isAdult(new Date(Date.UTC(2008, 10, 16)), now)).toBe(true);
    expect(isAdult(new Date(Date.UTC(2008, 10, 17)), now)).toBe(false);
  });
  it('validates usernames and emails', () => {
    expect(isValidUsername('Marry_Out')).toBe(true);
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('no spaces')).toBe(false);
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('a@b')).toBe(false);
  });
});

describe('filters', () => {
  it('toggles categories and builds RPC params', () => {
    const f = toggleCategory(EMPTY_FILTERS, 'club');
    expect(f.categories).toEqual(['club']);
    expect(toggleCategory(f, 'club').categories).toEqual([]);
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, tonightOnly: true })).toBe(true);
    expect(toSearchParams({ lat: 1, lng: 2 }, 3000, { ...f, query: '  afro ' })).toEqual({
      origin_lat: 1,
      origin_lng: 2,
      radius_m: 3000,
      p_query: 'afro',
      p_categories: ['club'],
      p_max_price: null,
      p_music_tag: null,
      p_tonight_only: false,
    });
  });
});

describe('squads', () => {
  const opt = (id: string, votes: number): SquadOption => ({
    option_id: id,
    venue_id: id,
    name: id,
    category: 'bar',
    cover_photo_url: null,
    votes,
    voters: [],
  });
  it('finds a clear leader, not a tie', () => {
    expect(leadingOption([opt('a', 1), opt('b', 3)])?.option_id).toBe('b');
    expect(leadingOption([opt('a', 2), opt('b', 2)])).toBeNull();
    expect(leadingOption([opt('a', 0)])).toBeNull();
  });
  it('formats percentages, countdowns and links', () => {
    expect(votePercent(1, 3)).toBe(33);
    expect(votePercent(0, 0)).toBe(0);
    const now = new Date('2026-11-16T20:00:00Z');
    expect(closesInText('2026-11-16T20:45:00Z', now)).toBe('Closes in 45 min');
    expect(closesInText('2026-11-16T22:10:00Z', now)).toBe('Closes in 2 h 10 min');
    expect(closesInText('2026-11-16T19:00:00Z', now)).toBe('Voting closed');
    expect(squadLink('abc123')).toBe('https://onspot.app/s/abc123');
  });
});

describe('venue text', () => {
  it('describes status, events and vibe', () => {
    expect(capacityText('packed')).toBe('Packed');
    expect(queueText(0)).toBe('No queue');
    expect(queueText(15)).toBe('~15 min queue');
    expect(spotsText(0)).toBe('Sold out');
    expect(spotsText(12)).toBe('Only 12 spots left');
    expect(spotsText(80)).toBe('80 spots left');
    expect(vibeText(75)).toBe('On fire');
    expect(vibeText(0)).toBe('No live signal yet');
    const now = new Date('2026-11-16T21:00:00');
    expect(
      eventTimeText(
        { starts_at: new Date('2026-11-16T22:30:00').toISOString(), ends_at: null },
        now,
      ),
    ).toBe('From 22:30');
    expect(
      eventTimeText(
        { starts_at: new Date('2026-11-16T20:00:00').toISOString(), ends_at: null },
        now,
      ),
    ).toBe('On now');
  });
});

describe('host event form', () => {
  it('parses times and rolls late finishes to the next day', () => {
    expect(parseTime('22:00')).toEqual({ h: 22, m: 0 });
    expect(parseTime('25:00')).toBeNull();
    const now = new Date('2026-11-16T15:00:00');
    const t = buildEventTimes('22:00', '03:00', now) as { startsAt: string; endsAt: string };
    expect(new Date(t.endsAt).getTime() - new Date(t.startsAt).getTime()).toBe(5 * 3600_000);
    expect(buildEventTimes('nope', '03:00', now)).toBeNull();
    expect(isValidTicketUrl('https://tickets.example.com/x')).toBe(true);
    expect(isValidTicketUrl('http://tickets.example.com')).toBe(false);
  });
});

describe('misc', () => {
  it('builds walking directions per platform', () => {
    expect(directionsUrl('ios', 1, 2, 'Neon Club')).toBe(
      'http://maps.apple.com/?daddr=1,2&dirflg=w&q=Neon%20Club',
    );
    expect(directionsUrl('android', 1, 2, 'x')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=1,2&travelmode=walking',
    );
  });
  it('turns server codes into readable errors', () => {
    expect(errorText(new Error('username_taken'))).toBe('That username is taken.');
    expect(errorText({ message: 'voting_closed' })).toBe('Voting has closed.');
    expect(errorText(new Error('???'), 'fallback')).toBe('fallback');
    expect(friendRequestResultText('accepted')).toBe('You’re now friends.');
  });
});
