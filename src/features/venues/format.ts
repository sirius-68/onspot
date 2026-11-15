import type { VenueCategory } from './types';

const CATEGORY_LABELS: Record<VenueCategory, string> = {
  club: 'Club',
  bar: 'Bar',
  lounge: 'Lounge',
  live_music: 'Live music',
  day_party: 'Day party',
  pop_up: 'Pop-up',
  other: 'Venue',
};

export function categoryLabel(category: VenueCategory): string {
  return CATEGORY_LABELS[category] ?? 'Venue';
}

/** 0–999 m in metres rounded to 10, then km with one decimal. */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '';
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Walking time at ~80 m per minute, at least 1 min. */
export function formatWalkTime(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '';
  return `${Math.max(1, Math.round(meters / 80))} min walk`;
}

/** Price band 1–4 shown as £ signs. */
export function formatPriceBand(band: number | null, symbol = '£'): string {
  if (band === null || band < 1 || band > 4) return '';
  return symbol.repeat(band);
}

/** Two-letter initials for a venue without a cover photo. */
export function venueInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w));
  const first = words[0]?.[0] ?? '?';
  const second = words[1]?.[0] ?? words[0]?.[1] ?? '';
  return (first + second).toUpperCase();
}
