/** Parses "HH:MM" (24 h). */
export function parseTime(input: string): { h: number; m: number } | null {
  const match = input.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h <= 23 && m <= 59 ? { h, m } : null;
}

/**
 * Tonight's start/end as ISO strings. A start earlier than 06:00 counts as after midnight
 * (tomorrow); an end at or before the start rolls to the next day (e.g. 22:00 → 03:00).
 */
export function buildEventTimes(
  start: string,
  end: string,
  now: Date = new Date(),
): { startsAt: string; endsAt: string } | null {
  const s = parseTime(start);
  const e = parseTime(end);
  if (!s || !e) return null;
  const startDate = new Date(now);
  startDate.setHours(s.h, s.m, 0, 0);
  if (s.h < 6 && now.getHours() >= 6) startDate.setDate(startDate.getDate() + 1);
  const endDate = new Date(startDate);
  endDate.setHours(e.h, e.m, 0, 0);
  if (endDate.getTime() <= startDate.getTime()) endDate.setDate(endDate.getDate() + 1);
  return { startsAt: startDate.toISOString(), endsAt: endDate.toISOString() };
}

export function isValidTicketUrl(url: string): boolean {
  return /^https:\/\/[^\s]+\.[^\s]+/.test(url.trim());
}
