/** "just now", "4 min ago", "1 h ago" — how fresh a clip is. */
export function formatFreshness(publishedAt: string | Date, now: Date = new Date()): string {
  const t = typeof publishedAt === 'string' ? new Date(publishedAt) : publishedAt;
  const minutes = Math.floor((now.getTime() - t.getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}

/** Seconds left before a clip drops out of Live (60 minutes after publishing). */
export function liveSecondsLeft(publishedAt: string, now: Date = new Date()): number {
  const end = new Date(publishedAt).getTime() + 60 * 60_000;
  return Math.max(0, Math.round((end - now.getTime()) / 1000));
}

const ERROR_TEXT: Record<string, string> = {
  outside_venue: 'You need to be inside the venue to post a live clip.',
  stale_capture: 'That clip is too old. Live clips must be posted within 2 minutes.',
  rate_limited: 'You’ve posted a lot this hour. Try again a bit later.',
  unknown_venue: 'That venue no longer exists.',
  not_authenticated: 'Please sign in to post clips.',
  upload_missing: 'The upload didn’t finish. Please try again.',
  upload_too_late: 'The upload took too long. Please record a new clip.',
  profile_required: 'Finish your profile (18+) before posting.',
};

/** Maps a server error (message = code) to text people understand. */
export function clipErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const code = Object.keys(ERROR_TEXT).find((k) => message.includes(k));
  return code ? (ERROR_TEXT[code] as string) : 'Something went wrong posting your clip.';
}
