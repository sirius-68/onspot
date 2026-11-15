# Store readiness checklist

Use this before submitting to Google Play and the App Store.

## Age rating
- Onspot is **18+** (nightlife, alcohol venues, user-generated video). Answer the rating
  questionnaires accordingly (Play: Mature 17+ / restrict to 18+; App Store: 17+, and the
  app itself enforces 18+ at sign-up).

## Permissions (and why — these strings are in `app.config.ts`)
| Permission | Why | When asked |
| --- | --- | --- |
| Location (while using) | Venues near you; verify a clip was shot at the venue; share with friends (optional) | First map open |
| Camera | Record live clips in the app | First time you tap record |
| Microphone | Clip sound | First time you tap record |
- **No background location** is requested. Don't add it: it triggers extra review.

## User-generated content (both stores require these — all built in)
- Report a clip (flag icon on every clip) with reasons; 3 reports hide it pending review.
- Block a user (from the report flow and from the friends list).
- Community guidelines page (`/legal/guidelines`) and Terms (`/legal/terms`).
- A way to contact you: replace `privacy@onspot.app` in `src/features/legal/content.ts`.
- Review open reports in the Supabase table `public.reports` (Admin screen shows the count).

## Privacy labels / Data safety form
| Data | Collected | Linked to user | Purpose |
| --- | --- | --- | --- |
| Email | Yes | Yes | Account |
| Name, username | Yes | Yes | App functionality |
| Date of birth | Yes | Yes | Age check (never shown) |
| Precise location | Yes | Yes | App functionality (venues, clip check, friends) |
| Videos | Yes | Yes | User content |
| Product interaction | Only if PostHog key set | Pseudonymous id | Analytics |
- Not sold. Location history deleted after 24 h. Account deletion: in the app
  (Profile → Delete my account). Also give a web/email route in the store listing.

## Before public launch (not needed for internal testing)
- [ ] Lawyer review of `src/features/legal/content.ts` for the launch country.
- [ ] Real support email and privacy policy URL in the store listings.
- [ ] Sentry (or similar) crash reporting with your DSN.
