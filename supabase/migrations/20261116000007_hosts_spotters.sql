-- Phase 6: venue hosts (Host Live) and Spotters (paid local clip posters).

create table public.venue_hosts (
  venue_id uuid not null references public.venues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);
alter table public.venue_hosts enable row level security;
create policy "Hosts see their own venues"
  on public.venue_hosts for select
  to authenticated
  using (user_id = (select auth.uid()));
grant select on public.venue_hosts to authenticated;

create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'user')
$$;

create or replace function public.is_venue_host(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.venue_hosts h where h.venue_id = p_venue_id and h.user_id = auth.uid())
      or public.current_role_name() = 'admin'
$$;

create or replace function public.my_hosted_venues()
returns table (venue_id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.name
  from public.venues v
  where exists (select 1 from public.venue_hosts h where h.venue_id = v.id and h.user_id = auth.uid())
  order by v.name
$$;

create or replace function public.set_venue_status(
  p_venue_id uuid,
  p_capacity_level text,
  p_queue_minutes integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_venue_host(p_venue_id) then
    raise exception 'not_venue_host' using errcode = '42501';
  end if;
  insert into public.venue_status (venue_id, capacity_level, queue_minutes, updated_at, updated_by)
  values (p_venue_id, p_capacity_level, p_queue_minutes, now(), auth.uid())
  on conflict (venue_id) do update
    set capacity_level = excluded.capacity_level,
        queue_minutes = excluded.queue_minutes,
        updated_at = now(),
        updated_by = auth.uid();
end;
$$;

create or replace function public.host_upsert_event(
  p_venue_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz default null,
  p_price_text text default null,
  p_ticket_url text default null,
  p_spots_left integer default null,
  p_event_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_venue_host(p_venue_id) then
    raise exception 'not_venue_host' using errcode = '42501';
  end if;
  if p_event_id is null then
    insert into public.events (venue_id, title, starts_at, ends_at, price_text, ticket_url, spots_left, created_by)
    values (p_venue_id, p_title, p_starts_at, p_ends_at, p_price_text, p_ticket_url, p_spots_left, auth.uid())
    returning id into v_id;
  else
    update public.events
    set title = p_title, starts_at = p_starts_at, ends_at = p_ends_at, price_text = p_price_text,
        ticket_url = p_ticket_url, spots_left = p_spots_left
    where id = p_event_id and venue_id = p_venue_id
    returning id into v_id;
    if v_id is null then
      raise exception 'unknown_event' using errcode = 'P0001';
    end if;
  end if;
  return v_id;
end;
$$;

-- Admin tools (owner assigns hosts and Spotters).
create or replace function public.admin_set_role(p_username text, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_role_name() <> 'admin' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where username = lower(p_username);
  if not found then
    raise exception 'unknown_user' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.admin_assign_host(p_venue_id uuid, p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if public.current_role_name() <> 'admin' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select id into target from public.profiles where username = lower(p_username);
  if target is null then
    raise exception 'unknown_user' using errcode = 'P0001';
  end if;
  insert into public.venue_hosts (venue_id, user_id) values (p_venue_id, target) on conflict do nothing;
  update public.profiles set role = 'host' where id = target and role = 'user';
end;
$$;

-- Final create_clip: needs an 18+ profile, and labels where the clip came from
-- (official host clip, Spotter clip, or a regular user). Spotter clips are shown like any
-- other clip but kept apart in metrics.
create or replace function public.create_clip(
  p_venue_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m real,
  p_captured_at timestamptz,
  p_duration_s real default null
)
returns table (clip_id uuid, storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_geofence extensions.geography;
  v_point extensions.geography;
  v_id uuid := gen_random_uuid();
  v_path text;
  v_role text;
  v_source text := 'user';
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select role into v_role from public.profiles where id = uid;
  if v_role is null then
    raise exception 'profile_required' using errcode = 'P0001';
  end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'invalid_coordinates' using errcode = '22023';
  end if;
  if p_captured_at is null or p_captured_at < now() - interval '2 minutes'
     or p_captured_at > now() + interval '30 seconds' then
    raise exception 'stale_capture' using errcode = 'P0001';
  end if;
  if (select count(*) from public.clips c
      where c.author_id = uid and c.received_at > now() - interval '1 hour')
     >= (case when v_role in ('spotter', 'host', 'admin') then 40 else 10 end) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select v.geofence into v_geofence from public.venues v where v.id = p_venue_id;
  if v_geofence is null then
    raise exception 'unknown_venue' using errcode = 'P0001';
  end if;
  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  if not extensions.st_dwithin(v_geofence, v_point, public.clip_location_tolerance_m(p_accuracy_m)) then
    raise exception 'outside_venue' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.venue_hosts h where h.venue_id = p_venue_id and h.user_id = uid) then
    v_source := 'host';
  elsif v_role = 'spotter' then
    v_source := 'spotter';
  end if;

  v_path := uid::text || '/' || v_id::text || '.mp4';
  insert into public.clips (id, venue_id, author_id, storage_path, captured_at, lat, lng, accuracy_m, duration_s, source)
  values (v_id, p_venue_id, uid, v_path, p_captured_at, p_lat, p_lng, coalesce(p_accuracy_m, 75), p_duration_s, v_source);

  return query select v_id, v_path;
end;
$$;

-- Spotter tasks: nearby venues without a fresh clip in the last 30 minutes.
create or replace function public.spotter_tasks(
  origin_lat double precision,
  origin_lng double precision,
  radius_m integer default 3000
)
returns table (venue_id uuid, name text, distance_m double precision, minutes_since_clip integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  origin extensions.geography;
begin
  if public.current_role_name() not in ('spotter', 'admin') then
    raise exception 'spotters_only' using errcode = '42501';
  end if;
  origin := extensions.st_setsrid(extensions.st_makepoint(origin_lng, origin_lat), 4326)::extensions.geography;
  return query
    select v.id, v.name, extensions.st_distance(v.location, origin),
      (select floor(extract(epoch from now() - max(c.published_at)) / 60)::integer
         from public.clips c where c.venue_id = v.id and c.status = 'live')
    from public.venues v
    where extensions.st_dwithin(v.location, origin, least(radius_m, 20000))
      and not exists (
        select 1 from public.clips c
        where c.venue_id = v.id and c.status = 'live' and c.published_at > now() - interval '30 minutes'
      )
    order by extensions.st_distance(v.location, origin)
    limit 50;
end;
$$;

-- Verified clips per Spotter, for payouts (paid outside the app).
create or replace function public.spotter_stats()
returns table (clips_last_12h bigint, clips_last_7d bigint, venues_last_12h bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (where c.published_at > now() - interval '12 hours'),
    count(*) filter (where c.published_at > now() - interval '7 days'),
    count(distinct c.venue_id) filter (where c.published_at > now() - interval '12 hours')
  from public.clips c
  where c.author_id = auth.uid() and c.source = 'spotter' and c.status in ('live', 'hidden')
$$;

revoke all on function public.set_venue_status(uuid, text, integer) from public;
revoke all on function public.host_upsert_event(uuid, text, timestamptz, timestamptz, text, text, integer, uuid) from public;
revoke all on function public.admin_set_role(text, text) from public;
revoke all on function public.admin_assign_host(uuid, text) from public;
revoke all on function public.spotter_tasks(double precision, double precision, integer) from public;
revoke all on function public.spotter_stats() from public;
grant execute on function
  public.set_venue_status(uuid, text, integer),
  public.host_upsert_event(uuid, text, timestamptz, timestamptz, text, text, integer, uuid),
  public.admin_set_role(text, text),
  public.admin_assign_host(uuid, text),
  public.spotter_tasks(double precision, double precision, integer),
  public.spotter_stats(),
  public.my_hosted_venues()
to authenticated;
