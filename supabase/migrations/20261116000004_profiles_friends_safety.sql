-- Phase 3: profiles (18+), friends, friends-only location, Ghost Mode, block and report.

-- Profiles ------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) between 1 and 40),
  birthdate date not null,
  avatar_url text,
  ghost_mode boolean not null default false,
  role text not null default 'user' check (role in ('user', 'host', 'spotter', 'admin')),
  created_at timestamptz not null default now(),
  constraint profiles_adult check (birthdate <= (created_at - interval '18 years')::date)
);

alter table public.profiles enable row level security;

-- Signed-in people can see each other's public fields. Birthdate is never readable.
create policy "Profiles are visible to signed-in users"
  on public.profiles for select
  to authenticated
  using (true);

grant select (id, username, display_name, avatar_url, role, created_at) on public.profiles to authenticated;

create or replace function public.upsert_my_profile(
  p_username text,
  p_display_name text,
  p_birthdate date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if coalesce((select u.is_anonymous from auth.users u where u.id = uid), true) then
    raise exception 'account_required' using errcode = 'P0001';
  end if;
  if p_birthdate is null or p_birthdate > (now() - interval '18 years')::date then
    raise exception 'under_18' using errcode = 'P0001';
  end if;
  if lower(p_username) !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'invalid_username' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles p where p.username = lower(p_username) and p.id <> uid) then
    raise exception 'username_taken' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, username, display_name, birthdate)
  values (uid, lower(p_username), nullif(trim(p_display_name), ''), p_birthdate)
  on conflict (id) do update
    set username = excluded.username,
        display_name = excluded.display_name;
  -- Birthdate is set once; it can't be edited to dodge the age check.
end;
$$;

create or replace function public.my_profile()
returns table (id uuid, username text, display_name text, avatar_url text, ghost_mode boolean, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.ghost_mode, p.role
  from public.profiles p where p.id = auth.uid()
$$;

-- Friends -------------------------------------------------------------------------------
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

alter table public.friendships enable row level security;
create policy "See your own friendships"
  on public.friendships for select
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
grant select on public.friendships to authenticated;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id) = least(a, b)
      and greatest(f.requester_id, f.addressee_id) = greatest(a, b)
  )
$$;

-- Blocks (declared here because friend requests respect them).
create table public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
create policy "See who you blocked"
  on public.blocks for select
  to authenticated
  using (blocker_id = (select auth.uid()));
grant select on public.blocks to authenticated;

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks bl
    where (bl.blocker_id = a and bl.blocked_id = b) or (bl.blocker_id = b and bl.blocked_id = a)
  )
$$;

create or replace function public.send_friend_request(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  target uuid;
  existing public.friendships;
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid) then
    raise exception 'profile_required' using errcode = 'P0001';
  end if;
  select p.id into target from public.profiles p where p.username = lower(trim(p_username));
  if target is null or public.is_blocked_between(uid, target) then
    raise exception 'unknown_user' using errcode = 'P0001';
  end if;
  if target = uid then
    raise exception 'cannot_friend_self' using errcode = 'P0001';
  end if;

  select * into existing from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(uid, target)
    and greatest(f.requester_id, f.addressee_id) = greatest(uid, target);

  if existing.id is null then
    insert into public.friendships (requester_id, addressee_id) values (uid, target);
    return 'requested';
  elsif existing.status = 'accepted' then
    return 'already_friends';
  elsif existing.addressee_id = uid then
    -- They already asked you: asking back accepts.
    update public.friendships set status = 'accepted' where id = existing.id;
    return 'accepted';
  else
    return 'already_requested';
  end if;
end;
$$;

create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.friendships
    where id = p_request_id and addressee_id = auth.uid() and status = 'pending'
  ) then
    raise exception 'unknown_request' using errcode = 'P0001';
  end if;
  if p_accept then
    update public.friendships set status = 'accepted' where id = p_request_id;
  else
    delete from public.friendships where id = p_request_id;
  end if;
end;
$$;

create or replace function public.remove_friend(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(auth.uid(), p_user_id)
    and greatest(f.requester_id, f.addressee_id) = greatest(auth.uid(), p_user_id)
$$;

create or replace function public.my_friends()
returns table (
  request_id uuid,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  state text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    f.id,
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    case
      when f.status = 'accepted' then 'friend'
      when f.addressee_id = auth.uid() then 'incoming'
      else 'outgoing'
    end
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where auth.uid() in (f.requester_id, f.addressee_id)
  order by (f.status = 'accepted'), p.username
$$;

-- Friends-only location -----------------------------------------------------------------
-- Only shared while the app is open, only with accepted friends, never while in Ghost
-- Mode, and rows older than 24 h are deleted (see purge_old_locations).
create table public.user_locations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  location extensions.geography(point, 4326) not null,
  accuracy_m real,
  updated_at timestamptz not null default now()
);
alter table public.user_locations enable row level security;
-- No policies: nobody reads this table directly; friends_locations() decides who sees what.

create or replace function public.update_my_location(p_lat double precision, p_lng double precision, p_accuracy_m real)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if coalesce((select ghost_mode from public.profiles where id = uid), true) then
    -- Ghost Mode (or no profile yet): store nothing and wipe what was there.
    delete from public.user_locations where user_id = uid;
    return;
  end if;
  insert into public.user_locations (user_id, location, accuracy_m, updated_at)
  values (uid, extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography, p_accuracy_m, now())
  on conflict (user_id) do update
    set location = excluded.location, accuracy_m = excluded.accuracy_m, updated_at = now();
end;
$$;

create or replace function public.set_ghost_mode(p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set ghost_mode = p_on where id = auth.uid();
  if p_on then
    delete from public.user_locations where user_id = auth.uid();
  end if;
end;
$$;

create or replace function public.friends_locations()
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  lat double precision,
  lng double precision,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.username, p.display_name, p.avatar_url,
    extensions.st_y(l.location::extensions.geometry),
    extensions.st_x(l.location::extensions.geometry),
    l.updated_at
  from public.user_locations l
  join public.profiles p on p.id = l.user_id
  where auth.uid() is not null
    and l.user_id <> auth.uid()
    and p.ghost_mode = false
    and l.updated_at > now() - interval '4 hours'
    and public.are_friends(auth.uid(), l.user_id)
$$;

create or replace function public.purge_old_locations()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.user_locations where updated_at < now() - interval '24 hours' returning 1
  )
  select count(*)::integer from gone
$$;

-- Block and report ----------------------------------------------------------------------
create or replace function public.block_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_user_id = auth.uid() then
    raise exception 'invalid_block' using errcode = 'P0001';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), p_user_id)
  on conflict do nothing;
  perform public.remove_friend(p_user_id);
end;
$$;

create or replace function public.unblock_user(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_user_id
$$;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  clip_id uuid references public.clips (id) on delete cascade,
  reported_user_id uuid references auth.users (id) on delete cascade,
  reason text not null check (reason in ('nudity', 'violence', 'harassment', 'drugs', 'minor', 'spam', 'not_this_venue', 'other')),
  details text check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  check (clip_id is not null or reported_user_id is not null)
);
create unique index reports_once_per_clip on public.reports (reporter_id, clip_id) where clip_id is not null;
alter table public.reports enable row level security;
-- Moderators use the service role / dashboard; no client reads.

-- Clips hidden automatically after this many distinct reports, pending review.
create or replace function public.report_hide_threshold()
returns integer language sql immutable as $$ select 3 $$;

create or replace function public.report_clip(p_clip_id uuid, p_reason text, p_details text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from public.clips where id = p_clip_id) then
    raise exception 'unknown_clip' using errcode = 'P0001';
  end if;
  insert into public.reports (reporter_id, clip_id, reason, details)
  values (uid, p_clip_id, p_reason, p_details)
  on conflict do nothing;

  update public.clips c
  set report_count = (select count(*) from public.reports r where r.clip_id = c.id),
      status = case
        when c.status = 'live'
          and (select count(*) from public.reports r where r.clip_id = c.id) >= public.report_hide_threshold()
        then 'hidden' else c.status end
  where c.id = p_clip_id;
end;
$$;

create or replace function public.report_user(p_user_id uuid, p_reason text, p_details text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.reports (reporter_id, reported_user_id, reason, details)
  select auth.uid(), p_user_id, p_reason, p_details where auth.uid() is not null
$$;

-- Live clips now hide content between people who blocked each other, and carry the
-- author's username.
drop function public.venue_live_clips(uuid, integer);
create function public.venue_live_clips(p_venue_id uuid, p_limit integer default 30)
returns table (
  id uuid,
  venue_id uuid,
  author_id uuid,
  storage_path text,
  source text,
  published_at timestamptz,
  duration_s real,
  author_username text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.venue_id, c.author_id, c.storage_path, c.source, c.published_at, c.duration_s, p.username
  from public.clips c
  left join public.profiles p on p.id = c.author_id
  where c.venue_id = p_venue_id
    and c.status = 'live'
    and c.published_at > now() - interval '60 minutes'
    and (auth.uid() is null or not public.is_blocked_between(auth.uid(), c.author_id))
  order by c.published_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
$$;

-- Grants --------------------------------------------------------------------------------
revoke all on function public.upsert_my_profile(text, text, date) from public;
revoke all on function public.send_friend_request(text) from public;
revoke all on function public.respond_friend_request(uuid, boolean) from public;
revoke all on function public.remove_friend(uuid) from public;
revoke all on function public.update_my_location(double precision, double precision, real) from public;
revoke all on function public.set_ghost_mode(boolean) from public;
revoke all on function public.block_user(uuid) from public;
revoke all on function public.unblock_user(uuid) from public;
revoke all on function public.report_clip(uuid, text, text) from public;
revoke all on function public.report_user(uuid, text, text) from public;
revoke all on function public.purge_old_locations() from public;
revoke all on function public.are_friends(uuid, uuid) from public;
revoke all on function public.is_blocked_between(uuid, uuid) from public;

grant execute on function
  public.upsert_my_profile(text, text, date),
  public.my_profile(),
  public.send_friend_request(text),
  public.respond_friend_request(uuid, boolean),
  public.remove_friend(uuid),
  public.my_friends(),
  public.update_my_location(double precision, double precision, real),
  public.set_ghost_mode(boolean),
  public.friends_locations(),
  public.block_user(uuid),
  public.unblock_user(uuid),
  public.report_clip(uuid, text, text),
  public.report_user(uuid, text, text)
to authenticated;
grant execute on function public.venue_live_clips(uuid, integer) to anon, authenticated;
