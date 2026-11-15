# Onspot MVP — stack, build plan and debugging list

Source: the Onspot research and strategy doc (Phase 1 "MVP: one neighbourhood").
Status: **APPROVED 2026-11-15** (owner answered "yes to all" to the gate questions). Executing.

## Goal

Ship an Android-first (then iOS) app that proves one thing: people who open Onspot at night
end up walking into a venue. The MVP covers the Tonight map, verified live clips, venue profiles,
search and filters, Squad vote, directions, friends-only location, Host Live and Spotter mode.

## Stack decision

**Expo (React Native + TypeScript) on the client, Supabase on the backend.**

| Layer | Choice | Why |
| --- | --- | --- |
| App framework | Expo SDK (latest stable), Expo Router, TypeScript strict | One codebase for Android, iOS and web; dev builds support native modules; EAS builds APKs and store builds in the cloud; OTA updates for fast fixes on launch nights |
| Map | `@rnmapbox/maps` (Mapbox) | Custom night styling, fast clustering of many pins, photo-pin markers, heatmap layer for crowd heat |
| Camera / clips | `react-native-vision-camera` (capture), `expo-video` (playback), `expo-location` (location + accuracy) | Capture only in-app (Live Proof); playback with player recycling for the swipe carousel |
| Backend | Supabase: Postgres + **PostGIS**, Auth, Realtime, Storage (resumable TUS uploads), Edge Functions, pg_cron | Geofence checks and "venues near me" are SQL; Realtime pushes new clips onto the map; one vendor for the MVP |
| State / data | TanStack Query + Zustand; `supabase-js` | Cache and refetch for map data; small local UI state |
| UI | Own design tokens + `react-native-reanimated` + `react-native-gesture-handler`, `@gorhom/bottom-sheet`, `expo-image` | Dark "night" theme; smooth card carousel and sheets |
| Shared web | Expo Router web export for the Squad vote page (friends vote without installing) | Same code, hosted on a static host |
| Quality | ESLint + Prettier, Jest + React Native Testing Library, **pgTAP** for SQL/RLS tests, **Maestro** for end-to-end flows | Catch RLS holes and flow regressions early |
| Observability | Sentry (crashes), PostHog (product analytics, funnels) | Debugging on real devices after launch nights |
| CI | GitHub Actions: typecheck, lint, unit tests, DB tests (PostGIS + pgTAP via `scripts/db-test.sh`); EAS Build on tags | Every PR green before merge |

**Alternatives considered:** Flutter (strong UI performance, but Dart; fewer ready-made pieces for
Supabase Realtime + Mapbox + camera, and no shared web code with the vote page). Kotlin
Multiplatform (best native feel, slowest to build for a solo founder). Expo wins on speed of
building and iterating.

## Repo layout (after Phase 0)

```
onspot/
  src/
    app/               Expo Router screens (tabs: Map, Squads, Profile; host mode)
    components/        UI pieces (VenuePin, VenueCard, ClipCarousel, VibeBadge...)
    features/          map, clips, venues, squads, auth, host, spotter
    lib/               supabase client, location, analytics, env
    theme/             design tokens
  supabase/
    migrations/        SQL (PostGIS, tables, RLS, RPCs)
    functions/         Edge Functions (verify-clip, vibe-score, squad-vote)
    tests/             pgTAP tests
    seed.sql           launch-city venues for local dev
  e2e/                 Maestro flows
  plans/               this plan
```

## UI references (Mobbin, iOS)

| Onspot screen | References | What to take |
| --- | --- | --- |
| Tonight map | [Snapchat map](https://mobbin.com/screens/a3707e42-a285-47df-84ce-3049ccc344b1), [Hypelist map + card](https://mobbin.com/screens/4aa5bf2a-19c2-4a00-ab38-c94d0eb63025), [Luma discover map](https://mobbin.com/screens/fb378b19-93e3-4cac-b862-fd3208c4c59e), [Bump friends map](https://mobbin.com/screens/dc8faf44-5764-4432-8b90-2dd20582d91b) | Round photo pins with "Trending/Top pick" labels; filter chips across the top; a place card docked at the bottom; friends as avatar bubbles |
| Clip carousel / venue video | [Blackbird "For You" venue video](https://mobbin.com/screens/e12a9f89-383d-451a-b429-23b81e29ed4f), [TikTok location tag on video](https://mobbin.com/screens/e51dcfac-2e7d-406b-b9d6-f56901ac8ce8) | Full-bleed venue video with name, category and a View button; a Map/For You toggle at the top; a location chip on the clip |
| Tickets / Get In | [DICE quantity + checkout](https://mobbin.com/screens/cba1e7c8-4699-4eae-8cc7-0b9a952e137c), [Swiggy "18 tickets left"](https://mobbin.com/screens/53f3abe9-36b7-4297-9cf1-5c9aed5a4dc1), [Eventbrite sold-out tier](https://mobbin.com/screens/99d395c6-cf5b-4789-8aaa-aa3d6b8f6319) | Big quantity stepper and one checkout button; spots-left label; sold-out badge |
| Squad vote | [Locals poll in group chat](https://mobbin.com/screens/5ac0aef4-0cf6-4476-b65e-c5a4c5243da5), [Discord poll](https://mobbin.com/screens/081d2a05-5776-4773-90df-6266c453f38f), [Clubhouse live poll](https://mobbin.com/screens/e1a4b640-360a-477d-9c34-85359e60de87) | Poll card with percentages and voter avatars, time left, change vote |

## Phases

Order is risk-first: the native map + camera + geofence pieces are proven before anything
depends on them. Each step is a vertical slice that lands green.

### Phase 0: Foundations
Verified when: a dev build of the empty app runs on an Android device, and CI is green on a PR.
Files to touch: `package.json`, `app.json`/`app.config.ts`, `app/`, `src/lib/`, `src/theme/`,
`supabase/config.toml`, `.github/workflows/ci.yml`, `eas.json`, `.env.example`

#### Step 0.1: Scaffold the Expo app (Size: S)
- Acceptance criteria: Expo Router + TypeScript strict + ESLint/Prettier + Jest run; tabs Map / Squads / Profile render placeholders; night theme tokens exist
- Verification command: `npm run typecheck && npm run lint && npm test`
- Files likely touched: `package.json`, `app/_layout.tsx`, `app/(tabs)/*`, `src/theme/*`
- Test seams: Jest render test of the tab layout
- Blocked by: none

#### Step 0.2: Supabase project wiring (Size: S)
- Acceptance criteria: `supabase/` initialised; PostGIS enabled in the first migration; app reads URL/anon key from env; anonymous sign-in works
- Verification command: `supabase db reset && supabase test db && npm test`
- Files likely touched: `supabase/config.toml`, `supabase/migrations/0001_init.sql`, `src/lib/supabase.ts`, `.env.example`
- Test seams: pgTAP smoke test; a Jest test of the client factory
- Blocked by: 0.1

#### Step 0.3: CI and EAS dev build (Size: S)
- Acceptance criteria: GitHub Actions runs typecheck, lint, unit and DB tests on every PR; `eas build --profile development --platform android` produces an installable dev client
- Verification command: CI green on the PR; dev client installs and opens on a phone
- Files likely touched: `.github/workflows/ci.yml`, `eas.json`, `app.config.ts`
- Test seams: CI itself
- Blocked by: 0.1, 0.2

### Phase 1: Tonight map (risk spike: Mapbox)
Verified when: the map shows seeded venues as photo pins near the user, clustered when zoomed out.
Files to touch: `supabase/migrations/0002_venues.sql`, `supabase/seed.sql`, `src/features/map/*`, `app/(tabs)/index.tsx`

#### Step 1.1: Venues schema + nearby RPC (Size: S)
- Acceptance criteria: `venues` table (name, category, geofence polygon, point, cover photo, price band, music tags); `venues_near(lat, lng, radius_m)` RPC returns venues by distance; RLS: public read
- Verification command: `supabase test db`
- Files likely touched: `supabase/migrations/0002_venues.sql`, `supabase/tests/venues.test.sql`, `supabase/seed.sql`
- Test seams: pgTAP on the RPC and RLS
- Blocked by: 0.2

#### Step 1.2: Map screen with photo pins (Size: M)
- Acceptance criteria: Mapbox night style; user location dot after permission; venue photo pins from the RPC; clustering; tapping a pin opens a bottom venue card
- Verification command: `npm test` + manual check on the dev build (`e2e/map.yaml` with Maestro)
- Files likely touched: `src/features/map/*`, `src/components/VenuePin.tsx`, `src/components/VenueCard.tsx`
- Test seams: Jest for the data hook; Maestro flow for the screen
- Blocked by: 0.3, 1.1

### Phase 2: Live Proof clips (highest product risk)
Verified when: a clip shot inside a venue's geofence appears on that venue within seconds for another device, shows "N min ago", and leaves Live after 60 minutes; a clip shot outside is rejected.
Files to touch: `supabase/migrations/0003_clips.sql`, `supabase/functions/verify-clip/*`, `src/features/clips/*`

#### Step 2.1: Clips schema + verify-clip function (Size: M)
- Acceptance criteria: `clips` table (venue, author, storage path, captured_at, lat/lng, accuracy, status); Edge Function checks the point (with accuracy tolerance) is inside the venue geofence and `captured_at` is within 2 minutes of server time; live view = verified clips younger than 60 min
- Verification command: `supabase test db && supabase functions serve` + `deno test supabase/functions/verify-clip`
- Files likely touched: `supabase/migrations/0003_clips.sql`, `supabase/functions/verify-clip/index.ts`, tests
- Test seams: Deno unit tests on the geofence rule; pgTAP on the live view and RLS
- Blocked by: 1.1

#### Step 2.2: In-app capture + resumable upload (Size: M)
- Acceptance criteria: camera screen records up to 15 s; no gallery import; upload via TUS resumes after a network drop; pending/rejected states shown
- Verification command: Maestro `e2e/capture.yaml` on device + manual airplane-mode test
- Files likely touched: `src/features/clips/capture/*`, `src/lib/upload.ts`
- Test seams: Jest for the upload state machine; device test
- Blocked by: 0.3, 2.1

#### Step 2.3: Clip carousel on map and venue (Size: M)
- Acceptance criteria: swipe left/right through live clips of the selected venue; only the visible clip plays; freshness badge; Realtime adds new clips without refresh
- Verification command: Maestro `e2e/carousel.yaml`; memory check in Android Studio profiler while swiping 30 clips
- Files likely touched: `src/components/ClipCarousel.tsx`, `src/features/clips/*`
- Test seams: Jest for "which clip plays" logic; device profiling
- Blocked by: 2.1, 1.2

### Phase 3: Accounts, friends and safety
Verified when: a user signs up (18+), adds a friend, sees only friends' bubbles, and Ghost Mode hides them instantly.
Files to touch: `supabase/migrations/0004_profiles_friends.sql`, `src/features/auth/*`, `src/features/friends/*`

#### Step 3.1: Sign-in + 18+ gate + profile (Size: M)
- Acceptance criteria: sign-in methods per gate answer Q8; date-of-birth gate blocks under 18; anonymous session upgrades without losing clips
- Verification command: `supabase test db` + Maestro `e2e/signup.yaml`
- Files likely touched: `src/features/auth/*`, `app/(auth)/*`, migration
- Test seams: pgTAP on profile RLS; Maestro flow
- Blocked by: 0.2

#### Step 3.2: Friends + friends-only location + Ghost Mode (Size: M)
- Acceptance criteria: friend requests by username/contacts; location shared only with accepted friends while the app is open; Ghost Mode stops sharing; location rows auto-deleted after 24 h
- Verification command: `supabase test db` (RLS tests prove a stranger cannot read a location)
- Files likely touched: migration, `src/features/friends/*`, `src/features/map/FriendBubbles.tsx`
- Test seams: pgTAP RLS tests are the main proof
- Blocked by: 3.1, 1.2

#### Step 3.3: Report, block and takedown (Size: S)
- Acceptance criteria: report a clip or user; block hides content both ways; a reported clip is hidden after N reports pending review (required for store approval of user content)
- Verification command: `supabase test db` + Maestro `e2e/report.yaml`
- Files likely touched: migration, `src/features/moderation/*`
- Test seams: pgTAP
- Blocked by: 2.1, 3.1

### Phase 4: Venue profiles, search and directions
Verified when: a user filters "under budget, within 20 min, music tag", opens a venue profile and hands off to Maps for directions.

#### Step 4.1: Venue profile (Size: M)
- Acceptance criteria: header clip, tonight's events, price, queue estimate (from Host Live), ticket link-out button, spots left when provided
- Verification command: Maestro `e2e/venue.yaml`
- Files likely touched: `app/venue/[id].tsx`, `src/features/venues/*`, migration for `events`
- Test seams: Jest for formatting helpers; Maestro
- Blocked by: 1.2, 2.3

#### Step 4.2: Search and filters (Size: S)
- Acceptance criteria: search by name/category; chips for price, distance, music, open now; results update pins and list
- Verification command: `supabase test db` (search RPC) + `npm test`
- Files likely touched: `src/features/search/*`, migration
- Test seams: pgTAP on the RPC
- Blocked by: 1.1

#### Step 4.3: Directions hand-off (Size: XS)
- Acceptance criteria: one tap opens Apple Maps / Google Maps walking directions to the venue
- Verification command: manual on Android and iOS
- Files likely touched: `src/lib/directions.ts`
- Test seams: Jest on URL building
- Blocked by: 4.1

### Phase 5: Squad vote
Verified when: a user sends three venues to a group chat; friends vote from the link (app or web, no install needed); the winner is shown to everyone in real time.

#### Step 5.1: Squads schema + vote RPC (Size: S)
- Acceptance criteria: `squads`, `squad_options`, `squad_votes`; one vote per person per squad (guests vote with a name via signed link); closes at a set time
- Verification command: `supabase test db`
- Blocked by: 3.1

#### Step 5.2: Create-squad flow in app (Size: M)
- Acceptance criteria: pick up to 3 venues from the map; share sheet sends the link; live results with avatars
- Verification command: Maestro `e2e/squad.yaml`
- Blocked by: 5.1, 4.1

#### Step 5.3: Web vote page (Size: S)
- Acceptance criteria: the link opens a web page that shows the 3 venues with a clip thumbnail and lets a guest vote; deep-links into the app when installed
- Verification command: Playwright smoke test of the exported web page
- Blocked by: 5.1

### Phase 6: Host Live and Spotter mode
Verified when: a venue staff account posts official clips and capacity that show on the venue; a Spotter sees tasks for venues needing fresh clips and their verified-clip count for payout.

#### Step 6.1: Roles + venue claim (Size: S)
- Acceptance criteria: roles user / host / spotter / admin; admin assigns a host to a venue; RLS restricts host writes to their venues
- Verification command: `supabase test db`
- Blocked by: 3.1

#### Step 6.2: Host Live mode (Size: M)
- Acceptance criteria: host switches to Host mode; posts clips labelled "Official"; sets capacity (quiet / busy / packed) and queue estimate
- Verification command: Maestro `e2e/host.yaml`
- Blocked by: 6.1, 2.2

#### Step 6.3: Spotter mode (Size: M)
- Acceptance criteria: task board lists venues without a clip in the last 30 min; verified clips counted per Spotter per night; spotter clips labelled in data (not hidden from users, kept apart in metrics)
- Verification command: `supabase test db` + Maestro `e2e/spotter.yaml`
- Blocked by: 6.1, 2.1

### Phase 7: Vibe Score v1 and freshness metrics
Verified when: every venue shows a 0–100 score that rises with fresh clips, check-ins and host capacity, and the admin view shows freshness coverage per venue per hour.

#### Step 7.1: Vibe Score job (Size: S)
- Acceptance criteria: pg_cron recomputes scores every 2 minutes from the last 60 minutes of signals; score and its inputs stored per venue
- Verification command: `supabase test db` (scoring function tested with fixtures)
- Blocked by: 2.1, 6.2

#### Step 7.2: Metrics views (Size: S)
- Acceptance criteria: SQL views for freshness coverage, organic clip share, squad rate; PostHog events for open → venue view → directions → arrival
- Verification command: `supabase test db` + PostHog live events check
- Blocked by: 7.1, 5.2

### Phase 8: Hardening and beta
Verified when: crash-free sessions above 99% across one test week; internal testers on Play internal track (and TestFlight if iOS is in scope).

#### Step 8.1: Observability (Size: S) — Sentry + source maps, PostHog. Blocked by: 0.3
#### Step 8.2: Performance pass (Size: M) — map with 300 pins at 60 fps on a mid-range Android; carousel memory flat. Blocked by: 2.3, 4.2
#### Step 8.3: Store readiness (Size: S) — permission strings, 17+/18+ rating, privacy labels, UGC policy pages. Blocked by: 3.3
#### Step 8.4: Beta release (Size: S) — EAS production build, internal track, Maestro suite green. Blocked by: 8.1–8.3

## Debugging list

Known failure classes for this stack, how each shows up, and the first thing to check.

| # | Area | Symptom | First check / tool |
| --- | --- | --- | --- |
| D1 | Native build | Dev build fails or map/camera is blank in Expo Go | These modules need a dev client, not Expo Go; rebuild with `eas build --profile development`; check config plugins in `app.config.ts` |
| D2 | Map (MapLibre) | Map tiles don't load / blank map | Style URL reachable from the phone (`EXPO_PUBLIC_MAP_STYLE_URL`); internet permission; attribution visible |
| D3 | Location permission | No user dot on iOS or Android 12+ | Purpose strings present; handle "approximate" location (Android) and "precise off" (iOS); show a fallback to search by area |
| D4 | Geofence false rejects | Clip rejected while inside a venue | Log accuracy radius; indoor GPS drift; tolerance = accuracy capped at e.g. 75 m plus a buffered polygon; compare with `ST_DWithin` |
| D5 | Fake location | Clips from spoofed GPS | Android mock-location flag; server-side time check; rate limits per device; flag impossible travel |
| D6 | Clock / TTL | Clips vanish early or late | Always use server `now()` for freshness, never the phone clock; store `captured_at` and `received_at` |
| D7 | Uploads | Uploads stall on bad club Wi-Fi/4G | TUS resumable upload; retry with backoff; queue offline; compress to 720p before upload |
| D8 | Video playback | Carousel stutters or memory climbs | Only the visible player plays; release players off-screen; preload next one only; profile with Android Studio Memory |
| D9 | Realtime | New clips not appearing, or duplicate subscriptions | One channel per visible venue; unsubscribe on unmount; check Supabase Realtime inspector |
| D10 | RLS | A user reads data they shouldn't (or can't read their own) | pgTAP tests per policy; test as `anon`, `authenticated`, stranger, friend, host |
| D11 | Deep links | Squad link opens the store instead of the app | Expo Router linking config, Android App Links `assetlinks.json`, iOS Associated Domains |
| D12 | Map performance | Low fps with many pins | Use clustered ShapeSource layers instead of React marker views for far zoom levels; images via sprite |
| D13 | Store review | Rejection for user content or location | Report/block exists, moderation contact, age rating, background location not requested |
| D14 | Crashes in the field | A tester reports "it closed" | Sentry issue + breadcrumbs; `adb logcat` for native crashes; reproduce with the Maestro flow |
| D15 | Tooling offline | `npx expo install` fails with "HTTP Proxy Network Error: Forbidden" (api.expo.dev unreachable) | Run with `EXPO_OFFLINE=1 EXPO_NO_DEPENDENCY_VALIDATION=1`; versions then come from the SDK's bundled list |
| D16 | TypeScript 6 | Tests fail typecheck with "Cannot find name 'describe'" | TS 6 no longer auto-includes `@types/*`; list them in `compilerOptions.types` |
| D17 | Peer versions | `npm install` ERESOLVE on `react-dom` | Pin `react-dom` to the exact `react` version (`npx expo install react-dom`) |
| D18 | Web export | "Unable to resolve @expo/metro-runtime" | Install it at top level: `npx expo install @expo/metro-runtime` |
| D19 | PL/pgSQL | "syntax error at end of input" on an `IF … CASE WHEN … THEN … END THEN` | PL/pgSQL ends the IF condition at the first `THEN`; wrap the CASE in parentheses |
| D20 | pgTAP | A row inserted by a function isn't visible in the same SELECT | Same-statement snapshot; capture the function result in a temp table, then query |
| D21 | Supabase auth | Email arrives with a link but no 6-digit code | Add `{{ .Token }}` to the Magic link and Change email templates |
| D22 | Storage | Clip upload fails with "new row violates row-level security" (path isn't `<user id>/…` or the session expired) | `create_clip` reserves the path; check `ensureSession()` ran and the storage insert policy exists (`db push`) |
| D23 | Scheduled jobs | Vibe Score stuck at 0 (pg_cron job not running) | `select * from cron.job;` — if missing, enable pg_cron in the dashboard and re-run the migration's schedule block |

Standard debugging loop for any bug: reproduce on a dev build → write a failing test at the
highest seam that shows it (pgTAP, Jest or Maestro) → fix → test green → note the class here if new.

## Decision log

| Decision | Chosen option | Why |
| --- | --- | --- |
| Client stack | Expo (React Native, TypeScript) | One codebase for Android/iOS/web; EAS cloud builds; OTA updates |
| Backend | Supabase with PostGIS | Geofences and nearby search in SQL; Realtime for live clips; Auth and Storage included |
| Map | ~~Mapbox via `@rnmapbox/maps`~~ → **MapLibre** (`@maplibre/maplibre-react-native` v11), style from `EXPO_PUBLIC_MAP_STYLE_URL` (default CARTO Dark Matter) | Changed 2026-11-16 at the owner's request to ship an APK now: no account, token or download key needed, so GitHub Actions can build it. Same clustering and photo pins |
| Order | Risk-first: map → clips → accounts | The native modules and geofence rule are the riskiest parts |
| Host tools | Inside the mobile app for the MVP | Avoids a second app before product proof (gate Q6: yes) |
| Package manager | npm, with `npx expo install` for native modules | Expo's default; avoids pnpm hoisting issues with React Native |
| Routes folder | `src/app/` | Expo SDK 58 convention; non-route code stays in `src/` |
| Clip hosting | Supabase Storage for the MVP | Gate Q7: yes |
| Sign-in | Google + Apple + email one-time code | Gate Q8: yes |
| Platforms | Android first; iOS kept buildable but untested until an Apple Developer account exists | Gate Q3: yes; Apple account not confirmed |
| Launch city | **Not answered.** Dev seed data uses a sample area (London, Shoreditch) behind one config value, swapped when the owner names the city | "Yes to all" didn't name a city |
| Git workflow | One branch + PR per phase into `main`, merged when CI is green | Gate Q10: yes |
| DB tests | `scripts/db-test.sh` runs migrations, seed and pgTAP on a throwaway local Postgres (with a small Supabase shim for roles and `auth.uid()`); same script in CI. `supabase test db` also works where Docker is available | No Docker in the build sandbox; one script for local and CI keeps results comparable |
| RPC naming | `venues_near(origin_lat, origin_lng, radius_m, max_results)` | Output columns are `lat`/`lng`; Postgres forbids input and output parameters with the same name |
| Web map | `TonightMap.web.tsx` shows a venue list instead of a map | The web export exists for the Squad vote page; the native map SDK is mobile-only |
| Camera | `expo-camera` (video mode) instead of `react-native-vision-camera` | Expo module with a config plugin; enough for ≤15 s clips; fewer native build issues |
| Clip verification | SQL functions `create_clip` / `finalize_clip` (security definer) instead of an Edge Function | Geofence + time + upload checks in one place, tested with pgTAP; no extra deploy step |
| Clip upload | Standard Storage upload with 3 retries and backoff; TUS resumable later if needed | ≤15 s clips are small; keeps the client simple |
| Analytics | PostHog HTTP capture API, no SDK; no-op without a key | Works before the account exists; no native dependency |
| Crash reporting | Root error boundary now; Sentry added when the DSN exists | Avoids a native plugin that needs build tokens before launch |
| Owner request 2026-11-16 | "Build the complete app; APIs later": Phases 2–8 built in one branch/PR (`build/phases-2-8`) | Faster than one PR per phase; device checks happen once keys exist |
| Account deletion | In-app (`delete_my_account`) | Google Play requires a deletion path for apps with accounts |
| APK delivery (2026-11-16) | `.github/workflows/android-apk.yml`: prebuild + `gradlew assembleRelease` (debug-key signed, arm64 + armv7), uploaded as an artifact and a GitHub pre-release | The build sandbox can't reach Google's Maven; no Expo account yet for EAS. Play Store builds still go through EAS with an upload key |
| Demo mode | No Supabase keys → 12 sample venues anchored around the user (`src/lib/demo.ts`), same filters as `search_venues`; accounts/clips disabled with a banner | Owner wants to try the app on a phone before adding APIs |

## Not yet specified

- Phase 2: on-device face blur of bystanders — fog; research ML Kit face detection in a frame processor at Phase 2 pickup. MVP fallback: moderation + takedown.
- Phase 4: ticketing link-out targets in the launch city (which platforms venues use) — depends on gate Q4.
- Phase 6: Spotter payout method (cash app, bank transfer, vouchers) — outside the app for the MVP; tracked as counts only.
- Phase 8: iOS release depends on an Apple Developer account (gate Q3).

## Always / Never

- Always: 18+ only; friends-only individual location; server time for freshness; RLS on every table with pgTAP tests; every step lands green.
- Never (in the MVP): own ticketing/payments, tables, subscriptions, multiple cities, AR, showing strangers' locations, importing clips from the gallery, selling location data.

## Gate questions (answered 2026-11-15: yes to all recommendations)

Recommended answer first; "yes" accepts it.

1. **Package installs:** this chat cannot download packages (network installs are off for the account). Will you turn on network access for package installs and start the build in a new chat? (Recommended: yes — without it nothing can be installed or tested.)
2. **Stack:** Expo + Supabase as above? (Recommended: yes.)
3. **Platforms:** Android first (APK/dev builds), iOS after the beta? Do you have an Apple Developer account? (Recommended: Android first.)
4. **Launch city:** which city (and neighbourhood) should the seed venues and map default to?
5. **Map provider:** Mapbox (needs a free Mapbox account and tokens)? (Recommended: yes; alternative Google Maps via `react-native-maps`.)
6. **Host tools:** inside the mobile app for the MVP, web dashboard later? (Recommended: yes.)
7. **Clip hosting:** Supabase Storage for the MVP, move to Mux/Cloudflare Stream if bandwidth grows? (Recommended: yes.)
8. **Sign-in:** Google + Apple + email one-time code (no SMS cost)? (Recommended: yes.)
9. **Accounts I need you to create and share as secrets:** a new Supabase project (URL + anon key; service key only as an EAS/GitHub secret), Mapbox tokens, an Expo account linked to EAS. (Recommended: one Supabase project named `onspot-dev` for now.)
10. **Git workflow:** one branch and pull request per phase into `main`, merged when CI is green? (Recommended: yes.)

## Assumptions (correct me now or I proceed)

1. The app name stays "Onspot" in code for now; renaming later is cheap.
2. English only for the MVP.
3. Dark theme only for the MVP.
4. Ticket purchases link out to the venue's existing ticketing; "spots left" is entered by the host.
5. No push notifications in the MVP (added with Squad vote reminders in Phase 5 if time allows).
6. The repo is **public** today, so no keys or tokens are ever committed; secrets live only in EAS and GitHub Actions secrets, with `.env.example` holding placeholders. (Tell me if you want it made private.)

## Progress

| Phase | Status |
| --- | --- |
| 0 Foundations | Code done 2026-11-16 (scaffold, Supabase wiring, CI, EAS profiles). **Waiting on owner:** first EAS dev build on a phone (needs Expo + Mapbox accounts) |
| 1 Tonight map | Code done 2026-11-16: venues schema + `venues_near` RPC (12 pgTAP tests), map with clusters + photo pins + venue card (Jest screen tests), Android + web bundles export. **Waiting on owner:** device check on the dev build |
| 2 Live Proof clips | Code done 2026-11-16: clips schema, `create_clip`/`finalize_clip` (geofence, freshness, upload check, rate limit), storage bucket + policies, Realtime, capture screen, upload with retries, clip carousel. 13 pgTAP + 7 Jest tests |
| 3 Accounts, friends, safety | Code done 2026-11-16: email code / Google / Apple, 18+ profiles, friends, friends-only location, Ghost Mode, block, report (auto-hide at 3), account deletion. 21 pgTAP tests |
| 4 Venue profiles, search, directions | Code done 2026-11-16: `get_venue`, events, door status, `search_venues` + filter chips, directions hand-off, ticket links |
| 5 Squad vote | Code done 2026-11-16: squads schema + RPCs, create flow, vote page for app + web guests. pgTAP + screen tests |
| 6 Host Live and Spotter mode | Code done 2026-11-16: venue hosts, door status, events, official clips, Spotter tasks + stats, admin role tools |
| 7 Vibe Score and metrics | Code done 2026-11-16: `vibe_score`, `compute_vibe_scores` on pg_cron every 2 min, `admin_metrics`, PostHog events |
| 8 Hardening and beta | Partly done: error boundary, legal pages (draft), store checklist (`docs/STORE.md`). **Waiting on owner:** keys, device testing (Maestro flows), Sentry DSN, internal track release |
