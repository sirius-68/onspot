# Onspot

The live layer of your city: see what's actually happening at venues right now (clips shot
at the venue in the last hour), agree on a plan with friends, and get in. Android first,
then iOS. 18+.

Plan and progress: [`plans/pending/onspot-mvp.md`](plans/pending/onspot-mvp.md) ·
Store checklist: [`docs/STORE.md`](docs/STORE.md)

## What's in the app

| Area | What it does |
| --- | --- |
| **Tonight map** | Venues near you as photo pins (green ring = live clips), clusters when zoomed out, search, filters (Tonight, budget, category), friends' bubbles (friends only) |
| **Live Proof clips** | Record ≤15 s in the app (no gallery import). The server checks you're inside the venue's geofence and the clip is fresh before it goes live; clips drop off after 60 min |
| **Venue page** | Swipe live clips, Vibe Score, door status and queue, tonight's events with ticket links and spots left, directions, "Ask the squad" |
| **Squad vote** | Pick 2–3 venues, share a link; friends vote in the app or on the web as guests; live results |
| **Accounts & safety** | Email code / Google / Apple sign-in, 18+ check, friends by username, friends-only location, Ghost Mode, report and block, account deletion |
| **Host Live** | Venue staff set door status and queue, post official clips, publish tonight's events |
| **Spotter mode** | Venues needing a fresh clip nearby, and verified-clip counts for payouts |
| **Admin** | Tonight's metrics (freshness, organic share, squads, reports), make Spotters, assign hosts |

## Stack

Expo SDK 58 (React Native, TypeScript, Expo Router) · MapLibre (`@maplibre/maplibre-react-native`, open source, no key) ·
`expo-camera` / `expo-video` · Supabase (Postgres + PostGIS, Auth, Realtime, Storage,
pg_cron) · TanStack Query · Jest · pgTAP.

## Try it on Android now

Every push to `main` builds an APK on GitHub Actions (`.github/workflows/android-apk.yml`)
and publishes it under **Releases** as a pre-release. Download it on your phone, open it and
allow installs from that source. Without Supabase keys the app runs in **demo mode**: no sign-in,
you're a guest with every role, and the whole app works on sample venues around your location
(feed with stories, map with photo cards, venue pages, posting clips, chats with ticket splits,
tonight's events, squads, friends, Host Live, Spotter mode, Admin). A local
stand-in backend (`src/lib/demoBackend.ts`) answers the same calls as Supabase and saves
everything on the phone; Profile → *Reset demo data* starts over.
To build a live version, add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
as repository secrets (Settings → Secrets and variables → Actions) and re-run the workflow.

## Setup (adding your APIs)

1. **Install:** `npm install` (Node 22).
2. **Keys:** copy `.env.example` to `.env` and fill it in. Never commit `.env` (the repo is public).
3. **Supabase project:**
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push        # creates every table, function, the clips bucket and scheduled jobs
   ```
   Then in the Supabase dashboard:
   - **Authentication → Sign In / Providers:** turn on *Allow anonymous sign-ins* and *Email*.
     For Google/Apple, enable each provider with its client ID/secret.
   - **Authentication → URL Configuration:** add `onspot://auth-callback` (and your web URL
     + `/auth-callback`) to *Redirect URLs*.
   - **Authentication → Email templates:** in *Magic link* and *Change email address*, include
     `{{ .Token }}` so emails carry the 6-digit code the app asks for.
   - **Sample data (dev only):** run `supabase/seed.sql` in the SQL editor.
   - **Make yourself admin:** sign up in the app, then run
     `update public.profiles set role = 'admin' where username = 'your_username';`
4. **Phone build** (the map and camera need a development build, not Expo Go):
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest build --profile development --platform android
   ```
   Install the APK, run `npx expo start`, and open the project from the dev client.
5. **Map style:** the default is the free CARTO Dark Matter style, fine for testing. Before a
   commercial launch, set `EXPO_PUBLIC_MAP_STYLE_URL` to a style you have rights to use
   (your own tiles, or a provider such as MapTiler or Stadia Maps).
6. **Squad vote web page:** `npx expo export --platform web` then deploy `dist/`
   (e.g. `npx eas-cli@latest deploy`). On other static hosts, rewrite `/s/*` to
   `/s/[code].html`. Set `EXPO_PUBLIC_WEB_URL` to that address.

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Start the dev server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm test` | Unit and screen tests (Jest) |
| `npm run test:db` | Migrations + seed + pgTAP tests on a throwaway local Postgres (needs PostgreSQL with PostGIS and pgTAP). With Docker: `npx supabase start && npx supabase test db` |

## Project layout

```
src/app/        screens (Expo Router): tabs, venue/[id], capture, s/[code], squad/new, host, spotter, admin, legal/[doc]
src/features/   map, clips, venues, auth, friends, squads, host, safety, profile, legal
src/components/ shared UI (pins, cards, clip carousel, buttons)
src/lib/        env, Supabase client, analytics, errors, directions
src/theme/      design tokens (night theme)
supabase/       migrations, seed, pgTAP tests
__tests__/      Jest tests
docs/           store readiness
plans/          build plan and progress
```
