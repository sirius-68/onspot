// Demo backend: a stand-in for Supabase that runs on the phone when the Supabase keys aren't
// set. It answers the same RPC names the app calls, so every screen works unchanged: you are
// signed in as a guest with every role (user, host, spotter, admin), and what you do (clips,
// squads, friends, host updates) is saved on this phone only. Server-side rules that need a
// real backend, such as the venue geofence for clips, are relaxed here.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { MyProfile } from '@/features/auth/api';
import type { FriendLocation, FriendRow } from '@/features/friends/api';
import type { VenueFilters } from '@/features/map/filters';
import type { Squad, SquadSummary } from '@/features/squads/api';
import type { CapacityLevel, VenueDetail } from '@/features/venues/useVenue';
import type { LatLng, VenueCategory } from '@/features/venues/types';

import {
  demoAnchor,
  demoVenueDetail,
  demoVenueIds,
  demoVenueName,
  demoVenueSeed,
  demoVenues,
  type DemoOverlay,
  searchDemoVenues,
} from './demo';
import { env } from './env';

const STORAGE_KEY = 'onspot.demo.v1';
export const DEMO_USER_ID = 'demo-user';
const LIVE_WINDOW_MS = 60 * 60_000;

type DemoClip = {
  id: string;
  venue_id: string;
  storage_path: string;
  source: 'user' | 'host' | 'spotter';
  published_at: string | null;
  created_at: string;
  duration_s: number | null;
};

type DemoSquad = {
  code: string;
  title: string;
  closes_at: string;
  created_at: string;
  venue_ids: string[];
  /** voter key → option index and display name */
  votes: Record<string, { option: number; name: string }>;
};

type DemoEvent = VenueDetail['events'][number];

export type DemoState = {
  profile: MyProfile;
  hosted: string[];
  roles: Record<string, MyProfile['role']>;
  clips: DemoClip[];
  /** storage path → local file uri */
  files: Record<string, string>;
  status: Record<
    string,
    { capacity_level: CapacityLevel; queue_minutes: number; updated_at: string }
  >;
  events: Record<string, DemoEvent[]>;
  squads: DemoSquad[];
  friends: FriendRow[];
  reports: string[];
};

/** Sample people for friends, squads and admin tools. */
const PEOPLE: Record<string, { id: string; display_name: string; near: string }> = {
  amara: { id: 'demo-amara', display_name: 'Amara', near: 'demo-3' },
  tunde: { id: 'demo-tunde', display_name: 'Tunde', near: 'demo-1' },
  zoe: { id: 'demo-zoe', display_name: 'Zoe', near: 'demo-5' },
  leo: { id: 'demo-leo', display_name: 'Leo', near: 'demo-9' },
  kemi: { id: 'demo-kemi', display_name: 'Kemi', near: 'demo-11' },
};

function person(username: string, state: FriendRow['state'], requestId: string): FriendRow {
  const p = PEOPLE[username]!;
  return {
    request_id: requestId,
    user_id: p.id,
    username,
    display_name: p.display_name,
    avatar_url: null,
    state,
  };
}

export function initialDemoState(): DemoState {
  return {
    profile: {
      id: DEMO_USER_ID,
      username: 'guest',
      display_name: 'Guest',
      avatar_url: null,
      ghost_mode: false,
      role: 'admin',
    },
    hosted: ['demo-1', 'demo-3'],
    roles: { leo: 'spotter' },
    clips: [],
    files: {},
    status: {},
    events: {},
    squads: [],
    friends: [
      person('amara', 'friend', 'req-amara'),
      person('tunde', 'friend', 'req-tunde'),
      person('zoe', 'incoming', 'req-zoe'),
    ],
    reports: [],
  };
}

class DemoError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

let idCounter = 0;
function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function squadCode(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

type Params = Record<string, unknown>;
type Result = { data: unknown; error: { message: string; code?: string } | null };

/** Saves a posted clip on the phone and returns a uri the video player can open. */
async function saveClipFile(path: string, body: unknown): Promise<string> {
  if (Platform.OS === 'web') {
    return URL.createObjectURL(new Blob([body as ArrayBuffer], { type: 'video/mp4' }));
  }
  const file = new File(Paths.document, 'demo-clips', path.replace(/\//g, '_'));
  file.create({ intermediates: true, overwrite: true });
  await file.write(body as ArrayBuffer);
  return file.uri;
}

export class DemoBackend {
  private state: DemoState | null = null;
  private loading: Promise<DemoState> | null = null;
  private listeners = new Set<(event: string, session: Session | null) => void>();

  constructor(
    private readonly kv: Pick<
      typeof AsyncStorage,
      'getItem' | 'setItem' | 'removeItem'
    > = AsyncStorage,
    private readonly now: () => Date = () => new Date(),
    private readonly writeFile: (path: string, body: unknown) => Promise<string> = saveClipFile,
  ) {}

  readonly session: Session = {
    access_token: 'demo',
    refresh_token: 'demo',
    expires_in: 3600 * 24 * 365,
    token_type: 'bearer',
    user: {
      id: DEMO_USER_ID,
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date(0).toISOString(),
      is_anonymous: false,
    },
  } as Session;

  async load(): Promise<DemoState> {
    if (this.state) return this.state;
    this.loading ??= (async () => {
      try {
        const raw = await this.kv.getItem(STORAGE_KEY);
        this.state = raw
          ? { ...initialDemoState(), ...(JSON.parse(raw) as Partial<DemoState>) }
          : initialDemoState();
      } catch {
        this.state = initialDemoState();
      }
      return this.state;
    })();
    return this.loading;
  }

  private async save() {
    if (this.state) await this.kv.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  async reset() {
    this.state = initialDemoState();
    await this.kv.removeItem(STORAGE_KEY);
    for (const listener of this.listeners) listener('SIGNED_IN', this.session);
  }

  private overlay(s: DemoState): DemoOverlay {
    const cutoff = this.now().getTime() - LIVE_WINDOW_MS;
    const liveClips: Record<string, number> = {};
    for (const c of s.clips) {
      if (c.published_at && Date.parse(c.published_at) > cutoff && !s.reports.includes(c.id)) {
        liveClips[c.venue_id] = (liveClips[c.venue_id] ?? 0) + 1;
      }
    }
    return { liveClips, status: s.status, events: s.events, hosted: s.hosted };
  }

  private anchor(): LatLng {
    const a = demoAnchor();
    if (a) return a;
    demoVenues(env.defaultCenter);
    return demoAnchor() ?? env.defaultCenter;
  }

  private requireHost(s: DemoState, venueId: unknown) {
    if (typeof venueId !== 'string' || !s.hosted.includes(venueId))
      throw new DemoError('not_venue_host');
  }

  private requireAdmin(s: DemoState) {
    if (s.profile.role !== 'admin') throw new DemoError('admin_only');
  }

  private knownUser(s: DemoState, username: unknown): string {
    const name = String(username ?? '')
      .trim()
      .toLowerCase();
    if (name !== s.profile.username && !PEOPLE[name]) throw new DemoError('unknown_user');
    return name;
  }

  private squadView(s: DemoState, sq: DemoSquad): Squad {
    const counts = sq.venue_ids.map(() => 0);
    const voters: string[][] = sq.venue_ids.map(() => []);
    for (const vote of Object.values(sq.votes)) {
      counts[vote.option] = (counts[vote.option] ?? 0) + 1;
      voters[vote.option]?.push(vote.name);
    }
    const mine = sq.votes[DEMO_USER_ID];
    return {
      code: sq.code,
      title: sq.title,
      closes_at: sq.closes_at,
      closed: Date.parse(sq.closes_at) <= this.now().getTime(),
      creator_username: s.profile.username,
      is_creator: true,
      total_votes: counts.reduce((a, b) => a + b, 0),
      my_option_id: mine ? `${sq.code}-${mine.option}` : null,
      options: sq.venue_ids.map((venueId, i) => ({
        option_id: `${sq.code}-${i}`,
        venue_id: venueId,
        name: demoVenueName(venueId) ?? 'Venue',
        category: (demoVenueSeed(venueId)?.category ?? 'bar') as VenueCategory,
        cover_photo_url: null,
        votes: counts[i] ?? 0,
        voters: voters[i] ?? [],
      })),
    };
  }

  /** The RPCs the app calls, answered from local state. */
  async rpc(name: string, p: Params = {}): Promise<Result> {
    try {
      return { data: await this.handle(name, p), error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { data: null, error: { message, code: e instanceof DemoError ? e.code : undefined } };
    }
  }

  private async handle(name: string, p: Params): Promise<unknown> {
    const s = await this.load();
    const now = this.now();
    switch (name) {
      // Venues
      case 'venues_near':
      case 'search_venues': {
        const filters: VenueFilters = {
          query: String(p.p_query ?? ''),
          categories: (p.p_categories as VenueCategory[] | null) ?? [],
          maxPrice: (p.p_max_price as number | null) ?? null,
          tonightOnly: Boolean(p.p_tonight_only),
        };
        const center = { lat: Number(p.origin_lat), lng: Number(p.origin_lng) };
        return searchDemoVenues(center, filters, Number(p.radius_m ?? 3000), this.overlay(s));
      }
      case 'get_venue': {
        this.anchor();
        return demoVenueDetail(String(p.p_venue_id), now, this.overlay(s));
      }

      // Profile
      case 'my_profile':
        return [s.profile];
      case 'upsert_my_profile': {
        const username = String(p.p_username ?? '')
          .trim()
          .toLowerCase();
        if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new DemoError('invalid_username');
        if (PEOPLE[username]) throw new DemoError('username_taken');
        s.profile = {
          ...s.profile,
          username,
          display_name: String(p.p_display_name ?? '') || null,
        };
        break;
      }
      case 'delete_my_account':
        await this.reset();
        return null;

      // Clips
      case 'create_clip': {
        if (!demoVenueName(String(p.p_venue_id))) throw new DemoError('unknown_venue');
        const id = newId('clip');
        const venueId = String(p.p_venue_id);
        const source = s.hosted.includes(venueId)
          ? 'host'
          : s.profile.role === 'spotter'
            ? 'spotter'
            : 'user';
        const clip: DemoClip = {
          id,
          venue_id: venueId,
          storage_path: `${venueId}/${id}.mp4`,
          source,
          published_at: null,
          created_at: now.toISOString(),
          duration_s: (p.p_duration_s as number | null) ?? null,
        };
        s.clips.push(clip);
        await this.save();
        return [{ clip_id: id, storage_path: clip.storage_path }];
      }
      case 'finalize_clip': {
        const clip = s.clips.find((c) => c.id === p.p_clip_id);
        if (!clip) throw new DemoError('unknown_clip');
        if (!s.files[clip.storage_path]) throw new DemoError('upload_missing');
        clip.published_at = now.toISOString();
        break;
      }
      case 'venue_live_clips': {
        const cutoff = now.getTime() - LIVE_WINDOW_MS;
        return s.clips
          .filter(
            (c) =>
              c.venue_id === p.p_venue_id &&
              c.published_at &&
              Date.parse(c.published_at) > cutoff &&
              !s.reports.includes(c.id),
          )
          .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
          .map((c) => ({
            id: c.id,
            venue_id: c.venue_id,
            author_id: DEMO_USER_ID,
            storage_path: c.storage_path,
            source: c.source,
            published_at: c.published_at,
            duration_s: c.duration_s,
            author_username: s.profile.username,
          }));
      }
      case 'report_clip':
        if (!s.reports.includes(String(p.p_clip_id))) s.reports.push(String(p.p_clip_id));
        break;

      // Friends
      case 'my_friends':
        return s.friends;
      case 'send_friend_request': {
        const username = this.knownUser(s, p.p_username);
        if (username === s.profile.username) throw new DemoError('cannot_friend_self');
        const existing = s.friends.find((f) => f.username === username);
        if (existing?.state === 'friend') return 'already_friends';
        if (existing?.state === 'outgoing') return 'already_requested';
        if (existing?.state === 'incoming') {
          existing.state = 'friend';
          await this.save();
          return 'accepted';
        }
        s.friends.push(person(username, 'outgoing', newId('req')));
        await this.save();
        return 'requested';
      }
      case 'respond_friend_request': {
        const row = s.friends.find(
          (f) => f.request_id === p.p_request_id && f.state === 'incoming',
        );
        if (!row) throw new DemoError('unknown_request');
        if (p.p_accept) row.state = 'friend';
        else s.friends = s.friends.filter((f) => f !== row);
        break;
      }
      case 'remove_friend':
      case 'block_user':
        s.friends = s.friends.filter((f) => f.user_id !== p.p_user_id);
        break;
      case 'friends_locations': {
        const a = this.anchor();
        return s.friends
          .filter((f) => f.state === 'friend' && PEOPLE[f.username])
          .map((f): FriendLocation => {
            const near = demoVenueSeed(PEOPLE[f.username]!.near);
            return {
              user_id: f.user_id,
              username: f.username,
              display_name: f.display_name,
              avatar_url: null,
              lat: a.lat + (near?.dLat ?? 0) + 0.00012,
              lng: a.lng + (near?.dLng ?? 0) + 0.00012,
              updated_at: new Date(now.getTime() - 4 * 60_000).toISOString(),
            };
          });
      }
      case 'update_my_location':
        return null;
      case 'set_ghost_mode':
        s.profile = { ...s.profile, ghost_mode: Boolean(p.p_on) };
        break;

      // Squads
      case 'create_squad': {
        const venueIds = (p.p_venue_ids as string[] | null) ?? [];
        if (venueIds.length < 2 || venueIds.length > 3) throw new DemoError('pick_2_or_3_venues');
        if (venueIds.some((id) => !demoVenueName(id))) throw new DemoError('invalid_venues');
        const code = squadCode();
        // Two friends vote straight away so the demo shows a live vote.
        const votes: DemoSquad['votes'] = {
          'demo-amara': { option: 0, name: 'Amara' },
          'demo-tunde': { option: 1, name: 'Tunde' },
        };
        s.squads.unshift({
          code,
          title: String(p.p_title ?? '') || 'Where are we going?',
          closes_at: new Date(
            now.getTime() + Number(p.p_closes_in_minutes ?? 180) * 60_000,
          ).toISOString(),
          created_at: now.toISOString(),
          venue_ids: venueIds,
          votes,
        });
        await this.save();
        return code;
      }
      case 'get_squad': {
        const sq = s.squads.find((x) => x.code === p.p_code);
        return sq ? this.squadView(s, sq) : null;
      }
      case 'cast_vote': {
        const sq = s.squads.find((x) => x.code === p.p_code);
        if (!sq) throw new DemoError('unknown_squad');
        if (Date.parse(sq.closes_at) <= now.getTime()) throw new DemoError('voting_closed');
        const option = sq.venue_ids.findIndex((_, i) => `${sq.code}-${i}` === p.p_option_id);
        if (option < 0) throw new DemoError('unknown_squad');
        sq.votes[DEMO_USER_ID] = { option, name: s.profile.display_name ?? s.profile.username };
        break;
      }
      case 'my_squads':
        return s.squads.map((sq): SquadSummary => ({
          code: sq.code,
          title: sq.title,
          closes_at: sq.closes_at,
          total_votes: Object.keys(sq.votes).length,
          created_at: sq.created_at,
        }));

      // Hosts
      case 'my_hosted_venues':
        return s.hosted
          .map((id) => ({ venue_id: id, name: demoVenueName(id) ?? 'Venue' }))
          .sort((a, b) => a.name.localeCompare(b.name));
      case 'set_venue_status':
        this.requireHost(s, p.p_venue_id);
        s.status[String(p.p_venue_id)] = {
          capacity_level: p.p_capacity_level as CapacityLevel,
          queue_minutes: Number(p.p_queue_minutes ?? 0),
          updated_at: now.toISOString(),
        };
        break;
      case 'host_upsert_event': {
        this.requireHost(s, p.p_venue_id);
        const venueId = String(p.p_venue_id);
        const event: DemoEvent = {
          id: newId('event'),
          title: String(p.p_title ?? ''),
          starts_at: String(p.p_starts_at),
          ends_at: String(p.p_ends_at),
          price_text: (p.p_price_text as string | null) ?? null,
          ticket_url: (p.p_ticket_url as string | null) ?? null,
          spots_left: (p.p_spots_left as number | null) ?? null,
        };
        s.events[venueId] = [...(s.events[venueId] ?? []), event];
        await this.save();
        return event.id;
      }

      // Spotters
      case 'spotter_tasks': {
        const center = { lat: Number(p.origin_lat), lng: Number(p.origin_lng) };
        const radius = Number(p.radius_m ?? 3000);
        const lastClip = (venueId: string) =>
          s.clips
            .filter((c) => c.venue_id === venueId && c.published_at)
            .map((c) => Date.parse(c.published_at as string))
            .sort((a, b) => b - a)[0];
        return demoVenues(center)
          .filter((v) => v.distance_m <= radius)
          .map((v) => {
            const last = lastClip(v.id);
            return {
              venue_id: v.id,
              name: v.name,
              distance_m: v.distance_m,
              minutes_since_clip: last ? Math.floor((now.getTime() - last) / 60_000) : null,
            };
          })
          .filter((t) => t.minutes_since_clip === null || t.minutes_since_clip >= 30);
      }
      case 'spotter_stats': {
        const mine = s.clips.filter((c) => c.published_at);
        const since = (ms: number) =>
          mine.filter((c) => Date.parse(c.published_at as string) > now.getTime() - ms);
        const last12 = since(12 * 3600_000);
        return [
          {
            clips_last_12h: last12.length,
            clips_last_7d: since(7 * 24 * 3600_000).length,
            venues_last_12h: new Set(last12.map((c) => c.venue_id)).size,
          },
        ];
      }

      // Admin
      case 'admin_metrics': {
        this.requireAdmin(s);
        const live = s.clips.filter(
          (c) => c.published_at && Date.parse(c.published_at) > now.getTime() - LIVE_WINDOW_MS,
        );
        const fresh = new Set(
          live
            .filter((c) => Date.parse(c.published_at as string) > now.getTime() - 30 * 60_000)
            .map((c) => c.venue_id),
        );
        const day = s.squads.filter(
          (sq) => Date.parse(sq.created_at) > now.getTime() - 24 * 3600_000,
        );
        const organic = s.clips.filter((c) => c.published_at && c.source === 'user').length;
        const published = s.clips.filter((c) => c.published_at).length;
        return {
          venues: demoVenueIds().length,
          venues_fresh_30m: fresh.size,
          live_clips_60m: live.length,
          organic_share_24h: published ? `${Math.round((organic / published) * 100)}%` : '–',
          squads_24h: day.length,
          squad_rate_24h: day.length
            ? `${Math.round((day.filter((sq) => Object.keys(sq.votes).length >= 2).length / day.length) * 100)}%`
            : '–',
          open_reports: s.reports.length,
        };
      }
      case 'admin_set_role': {
        this.requireAdmin(s);
        const username = this.knownUser(s, p.p_username);
        const role = p.p_role as MyProfile['role'];
        if (username === s.profile.username) s.profile = { ...s.profile, role };
        else s.roles[username] = role;
        break;
      }
      case 'admin_assign_host': {
        this.requireAdmin(s);
        const username = this.knownUser(s, p.p_username);
        const venueId = String(p.p_venue_id);
        if (!demoVenueName(venueId)) throw new DemoError('invalid_venues');
        if (username === s.profile.username && !s.hosted.includes(venueId)) s.hosted.push(venueId);
        break;
      }

      default:
        throw new Error(`demo_mode: ${name} is not available in demo mode`);
    }
    await this.save();
    return null;
  }

  // Storage: clips are saved on the phone.
  readonly storage = {
    from: (_bucket: string) => ({
      upload: async (path: string, body: unknown) => {
        try {
          const s = await this.load();
          s.files[path] = await this.writeFile(path, body);
          await this.save();
          return { data: { path }, error: null };
        } catch (e) {
          return {
            data: null,
            error: { message: e instanceof Error ? e.message : 'upload_failed' },
          };
        }
      },
      getPublicUrl: (path: string) => ({ data: { publicUrl: this.state?.files[path] ?? '' } }),
    }),
  };

  // Realtime isn't needed locally: queries refetch after each change.
  channel(_name: string) {
    const channel = {
      on: () => channel,
      subscribe: () => channel,
      unsubscribe: async () => 'ok',
    };
    return channel;
  }

  async removeChannel() {
    return 'ok';
  }

  // Auth: always signed in as the guest. "Sign out" resets the demo data.
  readonly auth = {
    getSession: async () => ({ data: { session: this.session }, error: null }),
    signInAnonymously: async () => ({
      data: { user: this.session.user, session: this.session },
      error: null,
    }),
    onAuthStateChange: (cb: (event: string, session: Session | null) => void) => {
      this.listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => this.listeners.delete(cb) } } };
    },
    signOut: async () => {
      await this.reset();
      return { error: null };
    },
    updateUser: async () => ({ data: null, error: { message: 'demo_mode' } }),
    signInWithOtp: async () => ({ data: null, error: { message: 'demo_mode' } }),
    verifyOtp: async () => ({ data: null, error: { message: 'demo_mode' } }),
    signInWithOAuth: async () => ({ data: { url: null }, error: { message: 'demo_mode' } }),
    exchangeCodeForSession: async () => ({ data: null, error: { message: 'demo_mode' } }),
  };

  /** Lets the app treat this object as a Supabase client. */
  asClient(): SupabaseClient {
    return this as unknown as SupabaseClient;
  }
}
