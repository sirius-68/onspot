// Server functions raise short codes (e.g. "username_taken"). This turns them into text.

const MESSAGES: Record<string, string> = {
  not_authenticated: 'Please sign in first.',
  account_required: 'Create an account to continue.',
  profile_required: 'Finish your profile (18+) to continue.',
  under_18: 'Onspot is for people aged 18 and over.',
  invalid_username: 'Usernames are 3–20 letters, numbers or underscores.',
  username_taken: 'That username is taken.',
  unknown_user: 'We couldn’t find that username.',
  cannot_friend_self: 'That’s you!',
  unknown_request: 'That request is no longer there.',
  pick_2_or_3_venues: 'Pick 2 or 3 venues.',
  invalid_venues: 'One of those venues is no longer available.',
  unknown_squad: 'This vote doesn’t exist anymore.',
  voting_closed: 'Voting has closed.',
  guest_name_required: 'Add your name to vote.',
  not_venue_host: 'Only this venue’s staff can do that.',
  spotters_only: 'Spotter mode is for approved Spotters.',
  admin_only: 'Admins only.',
  unknown_event: 'That event no longer exists.',
  demo_mode: 'Not available in demo mode. Add the Supabase keys to turn on accounts.',
  unknown_venue: 'That venue isn’t on Onspot.',
  upload_missing: 'The video didn’t upload. Try again with better signal.',
};

export function errorText(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error ?? '');
  const code = Object.keys(MESSAGES).find((k) => message.includes(k));
  return code ? (MESSAGES[code] as string) : fallback;
}

/** Throws the Supabase error so callers can use errorText(). */
export function unwrap<R extends { data: unknown; error: { message: string } | null }>(
  result: R,
): R['data'] {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
