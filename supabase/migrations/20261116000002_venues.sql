-- Phase 1: venues and the "venues near me" query.

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  category text not null
    check (category in ('club', 'bar', 'lounge', 'live_music', 'day_party', 'pop_up', 'other')),
  -- Pin position.
  location extensions.geography(point, 4326) not null,
  -- Area a clip must be shot inside to count as Live Proof (Phase 2).
  geofence extensions.geography(polygon, 4326) not null,
  address text,
  cover_photo_url text,
  price_band smallint check (price_band between 1 and 4),
  music_tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint venues_pin_inside_geofence check (extensions.st_covers(geofence, location))
);

comment on table public.venues is 'Places shown on the Tonight map.';

create index venues_location_idx on public.venues using gist (location);

alter table public.venues enable row level security;

-- Anyone may read venues; writes go through admin/host tooling (Phase 6) with the service role.
create policy "Venues are readable by everyone"
  on public.venues for select
  to anon, authenticated
  using (true);

grant select on public.venues to anon, authenticated;

-- Venues within radius_m of (origin_lat, origin_lng), nearest first.
-- Radius is capped at 50 km and results at 500 to keep the map payload small.
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
  music_tags text[]
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  origin extensions.geography;
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
      v.id,
      v.name,
      v.category,
      extensions.st_y(v.location::extensions.geometry) as lat,
      extensions.st_x(v.location::extensions.geometry) as lng,
      extensions.st_distance(v.location, origin) as distance_m,
      v.address,
      v.cover_photo_url,
      v.price_band,
      v.music_tags
    from public.venues v
    where extensions.st_dwithin(v.location, origin, least(radius_m, 50000))
    order by distance_m
    limit greatest(1, least(coalesce(max_results, 200), 500));
end;
$$;

comment on function public.venues_near is 'Venues within radius_m metres of (origin_lat, origin_lng), nearest first.';

revoke all on function public.venues_near(double precision, double precision, integer, integer) from public;
grant execute on function public.venues_near(double precision, double precision, integer, integer)
  to anon, authenticated;
