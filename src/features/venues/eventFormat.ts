import type { CapacityLevel, VenueEvent } from './useVenue';

const CAPACITY_TEXT: Record<CapacityLevel, string> = {
  quiet: 'Quiet',
  busy: 'Busy',
  packed: 'Packed',
};

export function capacityText(level: CapacityLevel | null | undefined): string | null {
  return level ? CAPACITY_TEXT[level] : null;
}

export function queueText(minutes: number | null | undefined): string | null {
  if (minutes == null) return null;
  if (minutes === 0) return 'No queue';
  return `~${minutes} min queue`;
}

/** "Now" if started, else "From 22:00" (24 h clock, the venue's local time on the phone). */
export function eventTimeText(
  event: Pick<VenueEvent, 'starts_at' | 'ends_at'>,
  now: Date = new Date(),
): string {
  const start = new Date(event.starts_at);
  const hhmm = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (start.getTime() <= now.getTime()) {
    return event.ends_at ? `On now · until ${hhmm(new Date(event.ends_at))}` : 'On now';
  }
  return `From ${hhmm(start)}`;
}

export function spotsText(spots: number | null | undefined): string | null {
  if (spots == null) return null;
  if (spots === 0) return 'Sold out';
  if (spots <= 20) return `Only ${spots} spots left`;
  return `${spots} spots left`;
}

export function vibeText(score: number): string {
  if (score >= 70) return 'On fire';
  if (score >= 40) return 'Buzzing';
  if (score >= 15) return 'Warming up';
  return 'No live signal yet';
}
