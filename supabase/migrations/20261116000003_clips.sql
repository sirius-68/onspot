-- Phase 2: Live Proof clips.
-- A clip only goes live if it was shot inside the venue's geofence, recently, and its video
-- file was actually uploaded. Clients never write the table directly: they call
-- create_clip (checks location and time, reserves a storage path) and then finalize_clip
-- (checks the upload exists, publishes). "Live" = published in the last 60 minutes.

create table public.clips (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique,
  captured_at timestamptz not null,
  received_at timestamptz not null default now(),
  lat double precision not null,
  lng double precision not null,
  accuracy_m real not null check (accuracy_m >= 0),
  duration_s real check (duration_s > 0 and duration_s <= 16),
  status text not null default 'pending_upload'
    check (status in ('pending_upload', 'live', 'rejected', 'hidden', 'removed')),
  source text not null default 'user' check (source in ('user', 'host', 'spotter')),
  report_count integer not null default 0,
  published_at timestamptz
);

create index clips_venue_live_idx on public.clips (venue_id, published_at desc) where status = 'live';
create index clips_author_idx on public.clips (author_id, received_at desc);

alter table public.clips enable row level security;

create policy "Live clips are public; authors see their own"
  on public.clips for select
  to anon, authenticated
  using (status = 'live' or author_id = (select auth.uid()));

grant select on public.clips to anon, authenticated;

-- Tolerance for GPS error: the reported accuracy, at least 10 m, at most 75 m
-- (debugging list D4: indoor GPS drifts).
create or replace function public.clip_location_tolerance_m(accuracy_m real)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select least(greatest(coalesce(accuracy_m, 75), 10), 75)::double precision
$$;

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
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'invalid_coordinates' using errcode = '22023';
  end if;
  -- Server time decides freshness (debugging list D6): shot in the last 2 minutes.
  if p_captured_at is null or p_captured_at < now() - interval '2 minutes'
     or p_captured_at > now() + interval '30 seconds' then
    raise exception 'stale_capture' using errcode = 'P0001';
  end if;
  if (select count(*) from public.clips c
      where c.author_id = uid and c.received_at > now() - interval '1 hour') >= 10 then
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

  v_path := uid::text || '/' || v_id::text || '.mp4';
  insert into public.clips (id, venue_id, author_id, storage_path, captured_at, lat, lng, accuracy_m, duration_s)
  values (v_id, p_venue_id, uid, v_path, p_captured_at, p_lat, p_lng, coalesce(p_accuracy_m, 75), p_duration_s);

  return query select v_id, v_path;
end;
$$;

create or replace function public.finalize_clip(p_clip_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.clips;
begin
  select * into c from public.clips where id = p_clip_id;
  if c.id is null or c.author_id is distinct from auth.uid() then
    raise exception 'unknown_clip' using errcode = 'P0001';
  end if;
  if c.status <> 'pending_upload' then
    raise exception 'already_finalized' using errcode = 'P0001';
  end if;
  if c.received_at < now() - interval '15 minutes' then
    update public.clips set status = 'rejected' where id = c.id;
    raise exception 'upload_too_late' using errcode = 'P0001';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'clips' and o.name = c.storage_path) then
    raise exception 'upload_missing' using errcode = 'P0001';
  end if;

  update public.clips set status = 'live', published_at = now() where id = c.id;
  return now();
end;
$$;

-- Live clips for one venue, newest first.
create or replace function public.venue_live_clips(p_venue_id uuid, p_limit integer default 30)
returns table (
  id uuid,
  venue_id uuid,
  author_id uuid,
  storage_path text,
  source text,
  published_at timestamptz,
  duration_s real
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.venue_id, c.author_id, c.storage_path, c.source, c.published_at, c.duration_s
  from public.clips c
  where c.venue_id = p_venue_id
    and c.status = 'live'
    and c.published_at > now() - interval '60 minutes'
  order by c.published_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
$$;

revoke all on function public.create_clip(uuid, double precision, double precision, real, timestamptz, real) from public;
revoke all on function public.finalize_clip(uuid) from public;
grant execute on function public.create_clip(uuid, double precision, double precision, real, timestamptz, real) to authenticated;
grant execute on function public.finalize_clip(uuid) to authenticated;
grant execute on function public.venue_live_clips(uuid, integer) to anon, authenticated;

-- Storage: public-read bucket; users may only upload into a folder named after themselves.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clips', 'clips', true, 31457280, array['video/mp4', 'video/quicktime'])
on conflict (id) do nothing;

create policy "Users upload clips into their own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'clips' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Clip files are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'clips');

-- New live clips appear on the map without a refresh.
alter publication supabase_realtime add table public.clips;
