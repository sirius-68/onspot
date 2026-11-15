// Product analytics via PostHog's HTTP capture API. No SDK: events are sent only when
// EXPO_PUBLIC_POSTHOG_KEY is set, so the app runs fine before the account exists.
// Never send personal data (names, emails, exact locations) as properties.

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

let distinctId = 'anonymous';

export function identify(userId: string) {
  distinctId = userId;
}

export type EventName =
  | 'app_open'
  | 'venue_viewed'
  | 'directions_opened'
  | 'ticket_link_opened'
  | 'clip_posted'
  | 'squad_created'
  | 'squad_voted'
  | 'signed_in'
  | 'friend_added'
  | 'report_sent';

export function track(
  event: EventName,
  properties: Record<string, string | number | boolean> = {},
) {
  if (!KEY) return;
  void fetch(`${HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: KEY, event, distinct_id: distinctId, properties }),
  }).catch(() => {
    // Analytics must never break the app.
  });
}
