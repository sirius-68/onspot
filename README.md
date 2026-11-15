# Onspot

The live layer of your city: see what's actually happening at venues right now, agree on a
plan with friends, and get in. Android first, then iOS.

Plan and progress: [`plans/pending/onspot-mvp.md`](plans/pending/onspot-mvp.md)

## Stack

Expo SDK 58 (React Native, TypeScript, Expo Router) · Mapbox (`@rnmapbox/maps`) ·
Supabase (Postgres + PostGIS, Auth, Realtime, Storage) · TanStack Query · Jest · pgTAP.

## Setup

1. **Install:** `npm install` (Node 22).
2. **Keys:** copy `.env.example` to `.env` and fill in:
   - Supabase project URL and anon key (Project settings → API)
   - Mapbox public token (`pk.…`)
   - Mapbox download token (`sk.…`, scope `DOWNLOADS:READ`) — build-time only
   Never commit `.env`: this repo is public.
3. **Database:** link your Supabase project and push the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push            # applies supabase/migrations
   ```
   In the Supabase dashboard, turn on **Authentication → Sign In / Providers → Allow anonymous
   sign-ins**. For sample venues, run `supabase/seed.sql` in the SQL editor (dev only).
4. **Run on a phone:** the map needs a development build (it doesn't work in Expo Go).
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest env:create --name RNMAPBOX_MAPS_DOWNLOAD_TOKEN --value sk.… --visibility secret --environment development
   npx eas-cli@latest build --profile development --platform android
   ```
   Install the APK from the link EAS gives you, then run `npx expo start` and open the project
   from the dev client.

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Start the dev server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm test` | Unit and screen tests (Jest) |
| `npm run test:db` | Migrations + seed + pgTAP tests on a throwaway local Postgres (needs PostgreSQL with PostGIS and pgTAP installed). With Docker you can use `npx supabase start && npx supabase test db` instead |

## Project layout

```
src/app/        screens (Expo Router)
src/features/   map, venues, … (one folder per feature)
src/components/ shared UI
src/lib/        env, Supabase client
src/theme/      design tokens (night theme)
supabase/       migrations, seed, pgTAP tests
__tests__/      Jest tests
plans/          build plan and progress
```
