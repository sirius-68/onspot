-- Phase 4 + 7: Vibe Score, search, the venue page query, metrics, scheduled jobs.

-- Vibe Score ----------------------------------------------------------------------------
-- 0–100 per venue from the last hour: each live clip adds up to 15 points, fading as it
-- ages (clips cap at 60), plus the host's door status (quiet 5 / busy 25 / packed 40)
-- when updated in the last 90 minutes.
create table public.venue_vibe (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  score smallint not null check (score between 0 and 100),
  live_clips integer not null default 0,
  capacity_level text,
  computed_at timestamptz not null default now()
);
alter table public.venue_vibe enable row level security;
create policy "Vibe is public" on public.venue_vibe for select to anon, authenticated using (true);
grant select on public.venue_vibe to anon, authenticated;

create or replace function public.vibe_score(clip_ages_minutes double precision[], capacity_level text)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select least(100, round((
    least(60, coalesce((
      select sum(15 * greatest(0, 1 - age / 60.0)) from unnest(clip_ages_minutes) age
    ), 0))
    + case capacity_level when 'packed' then 40 when 'busy' then 25 when 'quiet' then 5 else 0 end
  )::numeric))::smallint
$$;

create or replace function public.compute_vibe_scores()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  with signals as (
    select
      v.id as venue_id,
      array(
        select extract(epoch from now() - c.published_at) / 60.0
        from public.clips c
        where c.venue_id = v.id and c.status = 'live' and c.published_at > now() - interval '60 minutes'
      ) as ages,
      (select s.capacity_level from public.venue_status s
        where s.venue_id = v.id and s.updated_at > now() - interval '90 minutes') as capacity
    from public.venues v
  )
  insert into public.venue_vibe (venue_id, score, live_clips, capacity_level, computed_at)
  select venue_id, public.vibe_score(ages, capacity), coalesce(array_length(ages, 1), 0), capacity, now()
  from signals
  on conflict (venue_id) do update
    set score = excluded.score, live_clips = excluded.live_clips,
        capacity_level = excluded.capacity_level, computed_at = excluded.computed_at;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.compute_vibe_scores() from public;

-- Venues near me, now with vibe ----------------------------------------------------------
drop function public.venues_near(double precision, double precision, integer, integer);

create or replace function public.search_venues(
  origin_lat double precision,
  origin_lng double precision,
  radius_m integer default 3000,
  p_query text default null,
  p_categories text[] default null,
  p_max_price smallint default null,
  p_music_tag text default null,
  p_tonight_only boolean default false,
  max_results integer default 200
)
returns table (
  id uuid,
  name text,
  category text,
  lat double precision,
  lng double precision,
  distance_m double precision,
  address text,
  cover_photo_url text,
  price_band smallint,
  music_tags text[],
  vibe_score smallint,
  live_clip_count integer,
  capacity_level text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  origin extensions.geography;
  q text := nullif(trim(p_query), '');
begin
  if origin_lat is null or origin_lng is null
     or origin_lat < -90 or origin_lat > 90 or origin_lng < -180 or origin_lng > 180 then
    raise exception 'invalid coordinates' using errcode = '22023';
  end if;
  if radius_m is null or radius_m <= 0 then
    raise exception 'radius_m must be positive' using errcode = '22023';
  end if;
  origin := extensions.st_setsrid(extensions.st_makepoint(origin_lng, origin_lat), 4326)::extensions.geography;

  return query
    select
      v.id, v.name, v.category,
      extensions.st_y(v.location::extensions.geometry),
      extensions.st_x(v.location::extensions.geometry),
      extensions.st_distance(v.location, origin) as distance_m,
      v.address, v.cover_photo_url, v.price_band, v.music_tags,
      coalesce(vv.score, 0::smallint),
      coalesce(vv.live_clips, 0),
      vv.capacity_level
    from public.venues v
    left join public.venue_vibe vv on vv.venue_id = v.id
    where extensions.st_dwithin(v.location, origin, least(radius_m, 50000))
      and (q is null or v.name ilike '%' || q || '%' or v.category ilike '%' || q || '%'
           or exists (select 1 from unnest(v.music_tags) t where t ilike '%' || q || '%'))
      and (p_categories is null or cardinality(p_categories) = 0 or v.category = any (p_categories))
      and (p_max_price is null or v.price_band is null or v.price_band <= p_max_price)
      and (p_music_tag is null or p_music_tag = any (v.music_tags))
      and (not coalesce(p_tonight_only, false) or exists (
        select 1 from public.events e where e.venue_id = v.id and public.is_tonight(e.starts_at, e.ends_at)
      ))
    order by distance_m
    limit greatest(1, least(coalesce(max_results, 200), 500));
end;
$$;

create or replace function public.venues_near(
  origin_lat double precision,
  origin_lng double precision,
  radius_m integer default 3000,
  max_results integer default 200
)
returns table (
  id uuid,
  name text,
  category text,
  lat double precision,
  lng double precision,
  distance_m double precision,
  address text,
  cover_photo_url text,
  price_band smallint,
  music_tags text[],
  vibe_score smallint,
  live_clip_count integer,
  capacity_level text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from public.search_venues(origin_lat, origin_lng, radius_m, null, null, null, null, false, max_results)
$$;

grant execute on function public.venues_near(double precision, double precision, integer, integer) to anon, authenticated;
grant execute on function public.search_venues(double precision, double precision, integer, text, text[], smallint, text, boolean, integer) to anon, authenticated;

-- One venue for its page ----------------------------------------------------------------
create or replace function public.get_venue(p_venue_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', v.id,
    'name', v.name,
    'category', v.category,
    'address', v.address,
    'cover_photo_url', v.cover_photo_url,
    'price_band', v.price_band,
    'music_tags', to_jsonb(v.music_tags),
    'lat', extensions.st_y(v.location::extensions.geometry),
    'lng', extensions.st_x(v.location::extensions.geometry),
    'vibe_score', coalesce(vv.score, 0),
    'is_host', public.is_venue_host(v.id),
    'status', (
      select jsonb_build_object('capacity_level', s.capacity_level, 'queue_minutes', s.queue_minutes, 'updated_at', s.updated_at)
      from public.venue_status s where s.venue_id = v.id and s.updated_at > now() - interval '3 hours'
    ),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
        'price_text', e.price_text, 'ticket_url', e.ticket_url, 'spots_left', e.spots_left
      ) order by e.starts_at)
      from public.events e where e.venue_id = v.id and public.is_tonight(e.starts_at, e.ends_at)
    ), '[]'::jsonb)
  )
  from public.venues v
  left join public.venue_vibe vv on vv.venue_id = v.id
  where v.id = p_venue_id
$$;
grant execute on function public.get_venue(uuid) to anon, authenticated;

-- Metrics for the owner (admin only) ----------------------------------------------------
create or replace function public.admin_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_role_name() <> 'admin' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'venues', (select count(*) from public.venues),
    'venues_fresh_30m', (select count(distinct venue_id) from public.clips
                          where status = 'live' and published_at > now() - interval '30 minutes'),
    'live_clips_60m', (select count(*) from public.clips
                        where status = 'live' and published_at > now() - interval '60 minutes'),
    'organic_share_24h', (select round(avg((source = 'user')::int)::numeric, 2) from public.clips
                           where status in ('live', 'hidden') and published_at > now() - interval '24 hours'),
    'squads_24h', (select count(*) from public.squads where created_at > now() - interval '24 hours'),
    'squad_rate_24h', (select round(avg(case when (select count(*) from public.squad_votes v where v.squad_id = s.id) >= 2
                                              then 1 else 0 end)::numeric, 2)
                        from public.squads s where s.created_at > now() - interval '24 hours'),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'computed_at', now()
  );
end;
$$;
revoke all on function public.admin_metrics() from public;
grant execute on function public.admin_metrics() to authenticated;

-- Scheduled jobs (pg_cron is available on Supabase; skipped where it isn't) -------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('onspot-vibe-scores', '*/2 * * * *', 'select public.compute_vibe_scores()');
    perform cron.schedule('onspot-purge-locations', '17 * * * *', 'select public.purge_old_locations()');
  else
    raise notice 'pg_cron not available: run compute_vibe_scores() and purge_old_locations() another way';
  end if;
end
$$;
