-- Phase 5: Squad vote. Pick 2–3 venues, share a link, friends vote (in the app, or on the
-- web as a guest with a name), everyone sees the winner.

create table public.squads (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  creator_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Where are we going?' check (char_length(title) between 1 and 80),
  closes_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.squad_options (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  position smallint not null,
  unique (squad_id, venue_id)
);

create table public.squad_votes (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads (id) on delete cascade,
  option_id uuid not null references public.squad_options (id) on delete cascade,
  voter_id uuid references auth.users (id) on delete cascade,
  guest_key text check (guest_key is null or char_length(guest_key) between 16 and 64),
  voter_name text not null check (char_length(voter_name) between 1 and 40),
  created_at timestamptz not null default now(),
  voter_key text generated always as (coalesce(voter_id::text, 'guest:' || guest_key)) stored,
  check (voter_id is not null or guest_key is not null),
  unique (squad_id, voter_key)
);

alter table public.squads enable row level security;
alter table public.squad_options enable row level security;
alter table public.squad_votes enable row level security;
-- No direct access: everything goes through the functions below (the share code is the key).

create or replace function public.create_squad(
  p_venue_ids uuid[],
  p_title text default null,
  p_closes_in_minutes integer default 180
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
  v_code text;
  n integer := coalesce(array_length(p_venue_ids, 1), 0);
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if n < 2 or n > 3 then
    raise exception 'pick_2_or_3_venues' using errcode = 'P0001';
  end if;
  if (select count(distinct x) from unnest(p_venue_ids) x) <> n
     or (select count(*) from public.venues where id = any (p_venue_ids)) <> n then
    raise exception 'invalid_venues' using errcode = 'P0001';
  end if;

  v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  insert into public.squads (code, creator_id, title, closes_at)
  values (
    v_code, uid,
    coalesce(nullif(trim(p_title), ''), 'Where are we going?'),
    now() + make_interval(mins => least(greatest(coalesce(p_closes_in_minutes, 180), 10), 720))
  )
  returning id into v_id;

  insert into public.squad_options (squad_id, venue_id, position)
  select v_id, venue_id, ord::smallint
  from unnest(p_venue_ids) with ordinality as t(venue_id, ord);

  return v_code;
end;
$$;

create or replace function public.get_squad(p_code text, p_guest_key text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select * from public.squads where code = p_code
  ),
  me as (
    select coalesce(auth.uid()::text, case when p_guest_key is not null then 'guest:' || p_guest_key end) as key
  ),
  opts as (
    select
      o.id, o.venue_id, o.position, v.name, v.category, v.cover_photo_url,
      count(sv.id) as votes,
      coalesce(jsonb_agg(sv.voter_name order by sv.created_at) filter (where sv.id is not null), '[]'::jsonb) as voters
    from public.squad_options o
    join s on s.id = o.squad_id
    join public.venues v on v.id = o.venue_id
    left join public.squad_votes sv on sv.option_id = o.id
    group by o.id, v.id
  )
  select case when not exists (select 1 from s) then null else jsonb_build_object(
    'code', (select code from s),
    'title', (select title from s),
    'closes_at', (select closes_at from s),
    'closed', (select closes_at <= now() from s),
    'creator_username', (select p.username from s join public.profiles p on p.id = s.creator_id),
    'is_creator', (select creator_id = auth.uid() from s),
    'total_votes', (select coalesce(sum(votes), 0) from opts),
    'my_option_id', (
      select sv.option_id from public.squad_votes sv, s, me
      where sv.squad_id = s.id and sv.voter_key = me.key
    ),
    'options', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'option_id', id, 'venue_id', venue_id, 'name', name, 'category', category,
        'cover_photo_url', cover_photo_url, 'votes', votes, 'voters', voters
      ) order by position), '[]'::jsonb) from opts
    )
  ) end
$$;

create or replace function public.cast_vote(
  p_code text,
  p_option_id uuid,
  p_guest_key text default null,
  p_guest_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  s public.squads;
  v_name text;
begin
  select * into s from public.squads where code = p_code;
  if s.id is null then
    raise exception 'unknown_squad' using errcode = 'P0001';
  end if;
  if s.closes_at <= now() then
    raise exception 'voting_closed' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.squad_options where id = p_option_id and squad_id = s.id) then
    raise exception 'unknown_option' using errcode = 'P0001';
  end if;

  if uid is not null then
    v_name := coalesce(
      (select coalesce(p.display_name, p.username) from public.profiles p where p.id = uid),
      nullif(trim(p_guest_name), ''),
      'Guest'
    );
    insert into public.squad_votes (squad_id, option_id, voter_id, voter_name)
    values (s.id, p_option_id, uid, left(v_name, 40))
    on conflict (squad_id, voter_key) do update set option_id = excluded.option_id, created_at = now();
  else
    if p_guest_key is null or char_length(p_guest_key) < 16 or nullif(trim(p_guest_name), '') is null then
      raise exception 'guest_name_required' using errcode = 'P0001';
    end if;
    insert into public.squad_votes (squad_id, option_id, guest_key, voter_name)
    values (s.id, p_option_id, p_guest_key, left(trim(p_guest_name), 40))
    on conflict (squad_id, voter_key) do update set option_id = excluded.option_id, created_at = now();
  end if;
end;
$$;

create or replace function public.my_squads()
returns table (code text, title text, closes_at timestamptz, total_votes bigint, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.code, s.title, s.closes_at, (select count(*) from public.squad_votes v where v.squad_id = s.id), s.created_at
  from public.squads s
  where s.creator_id = auth.uid()
     or exists (select 1 from public.squad_votes v where v.squad_id = s.id and v.voter_id = auth.uid())
  order by s.created_at desc
  limit 30
$$;

revoke all on function public.create_squad(uuid[], text, integer) from public;
grant execute on function public.create_squad(uuid[], text, integer) to authenticated;
grant execute on function public.get_squad(text, text) to anon, authenticated;
grant execute on function public.cast_vote(text, uuid, text, text) to anon, authenticated;
grant execute on function public.my_squads() to authenticated;
