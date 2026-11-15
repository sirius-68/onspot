-- Feed (friends' clips + fire reactions), chats (direct messages + ticket-split requests),
-- and tonight's events for the Plans tab.

-- Reactions ------------------------------------------------------------------------------
create table public.clip_reactions (
  clip_id uuid not null references public.clips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (clip_id, user_id)
);
alter table public.clip_reactions enable row level security;
-- Written only through toggle_reaction; counts are read through friends_feed.

create or replace function public.toggle_reaction(p_clip_id uuid)
returns integer
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
  if not exists (select 1 from public.clips c where c.id = p_clip_id and c.status = 'live') then
    raise exception 'unknown_clip' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.clip_reactions r where r.clip_id = p_clip_id and r.user_id = uid) then
    delete from public.clip_reactions r where r.clip_id = p_clip_id and r.user_id = uid;
  else
    insert into public.clip_reactions (clip_id, user_id) values (p_clip_id, uid);
  end if;
  return (select count(*)::integer from public.clip_reactions r where r.clip_id = p_clip_id);
end
$$;

-- Feed: live clips from you and your friends in the last 24 hours. The app groups them into
-- stories (last 60 minutes, per person) and posts (per person and venue).
create or replace function public.friends_feed()
returns table (
  clip_id uuid,
  venue_id uuid,
  venue_name text,
  venue_cover_url text,
  author_id uuid,
  username text,
  display_name text,
  avatar_url text,
  storage_path text,
  published_at timestamptz,
  reactions integer,
  i_reacted boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.venue_id, v.name, v.cover_photo_url, c.author_id, p.username, p.display_name, p.avatar_url,
         c.storage_path, c.published_at,
         (select count(*)::integer from public.clip_reactions r where r.clip_id = c.id),
         exists (select 1 from public.clip_reactions r where r.clip_id = c.id and r.user_id = auth.uid())
  from public.clips c
  join public.venues v on v.id = c.venue_id
  join public.profiles p on p.id = c.author_id
  where auth.uid() is not null
    and c.status = 'live'
    and c.published_at > now() - interval '24 hours'
    and (c.author_id = auth.uid() or public.are_friends(auth.uid(), c.author_id))
  order by c.published_at desc
  limit 200
$$;

-- Chats ----------------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  -- Direct chats are unique per pair: least(user) || greatest(user).
  direct_key text unique,
  created_at timestamptz not null default now()
);
create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'split')),
  body text check (char_length(body) <= 2000),
  -- Ticket-split requests: an amount someone asks to be paid back. No money moves in the
  -- app until a payment provider is connected; "paid" is marked by the person asked.
  amount_minor integer check (amount_minor > 0 and amount_minor <= 1000000),
  currency text check (currency ~ '^[A-Z]{3}$'),
  paid_at timestamptz,
  -- clock_timestamp: exact order even for messages sent in one transaction.
  created_at timestamptz not null default clock_timestamp(),
  check (
    (kind = 'text' and char_length(body) >= 1 and amount_minor is null)
    or (kind = 'split' and amount_minor is not null and currency is not null)
  )
);
create index messages_conversation_time_idx on public.messages (conversation_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create or replace function public.is_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members m
    where m.conversation_id = p_conversation_id and m.user_id = auth.uid()
  )
$$;

-- Members can read (needed for Realtime); all writes go through the functions below.
create policy "Members read messages" on public.messages
  for select to authenticated using (public.is_member(conversation_id));
create policy "Members read membership" on public.conversation_members
  for select to authenticated using (public.is_member(conversation_id));
grant select on public.messages, public.conversation_members to authenticated;

create or replace function public.open_direct_conversation(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  k text;
  cid uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.are_friends(uid, p_user_id) then
    raise exception 'friends_only' using errcode = 'P0001';
  end if;
  k := least(uid, p_user_id)::text || ':' || greatest(uid, p_user_id)::text;
  select c.id into cid from public.conversations c where c.direct_key = k;
  if cid is null then
    insert into public.conversations (direct_key) values (k) returning id into cid;
    insert into public.conversation_members (conversation_id, user_id)
      values (cid, uid), (cid, p_user_id);
  end if;
  return cid;
end
$$;

create or replace function public.my_conversations()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  last_kind text,
  last_body text,
  last_amount_minor integer,
  last_currency text,
  last_sender_is_me boolean,
  last_at timestamptz,
  unread integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, o.user_id, p.username, p.display_name, p.avatar_url,
         lm.kind, lm.body, lm.amount_minor, lm.currency, lm.sender_id = auth.uid(),
         coalesce(lm.created_at, c.created_at),
         (select count(*)::integer from public.messages x
           where x.conversation_id = c.id and x.sender_id <> auth.uid() and x.created_at > me.last_read_at)
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  join public.conversation_members o on o.conversation_id = c.id and o.user_id <> me.user_id
  join public.profiles p on p.id = o.user_id
  left join lateral (
    select * from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1
  ) lm on true
  where me.user_id = auth.uid()
  order by coalesce(lm.created_at, c.created_at) desc
$$;

create or replace function public.conversation_messages(p_conversation_id uuid)
returns table (
  id uuid,
  sender_id uuid,
  kind text,
  body text,
  amount_minor integer,
  currency text,
  paid_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_member(p_conversation_id) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  update public.conversation_members m set last_read_at = clock_timestamp()
    where m.conversation_id = p_conversation_id and m.user_id = auth.uid();
  return query
    select * from (
      select m.id, m.sender_id, m.kind, m.body, m.amount_minor, m.currency, m.paid_at, m.created_at
      from public.messages m
      where m.conversation_id = p_conversation_id
      order by m.created_at desc
      limit 200
    ) recent
    order by recent.created_at;
end
$$;

create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  mid uuid;
begin
  if not public.is_member(p_conversation_id) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_body is null or char_length(trim(p_body)) = 0 then
    raise exception 'empty_message' using errcode = 'P0001';
  end if;
  insert into public.messages (conversation_id, sender_id, kind, body)
    values (p_conversation_id, auth.uid(), 'text', trim(p_body))
    returning id into mid;
  return mid;
end
$$;

create or replace function public.send_split_request(
  p_conversation_id uuid,
  p_amount_minor integer,
  p_currency text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  mid uuid;
begin
  if not public.is_member(p_conversation_id) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 or p_amount_minor > 1000000 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  insert into public.messages (conversation_id, sender_id, kind, body, amount_minor, currency)
    values (p_conversation_id, auth.uid(), 'split', nullif(trim(coalesce(p_note, '')), ''),
            p_amount_minor, upper(p_currency))
    returning id into mid;
  return mid;
end
$$;

-- Only the person asked (not the requester) marks a split as paid.
create or replace function public.mark_split_paid(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.messages;
begin
  select * into m from public.messages where id = p_message_id;
  if m.id is null or m.kind <> 'split' or not public.is_member(m.conversation_id) then
    raise exception 'unknown_message' using errcode = 'P0001';
  end if;
  if m.sender_id = auth.uid() then
    raise exception 'cannot_pay_own_request' using errcode = 'P0001';
  end if;
  update public.messages set paid_at = coalesce(paid_at, now()) where id = p_message_id;
end
$$;

-- Plans: tonight's events near you ----------------------------------------------------
create or replace function public.events_tonight(
  origin_lat double precision,
  origin_lng double precision,
  radius_m integer default 5000
)
returns table (
  event_id uuid,
  venue_id uuid,
  venue_name text,
  category text,
  cover_photo_url text,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  price_text text,
  ticket_url text,
  spots_left integer,
  distance_m double precision,
  lat double precision,
  lng double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, v.id, v.name, v.category, v.cover_photo_url, e.title, e.starts_at, e.ends_at,
         e.price_text, e.ticket_url, e.spots_left,
         extensions.st_distance(v.location, extensions.st_setsrid(extensions.st_makepoint(origin_lng, origin_lat), 4326)::extensions.geography),
         extensions.st_y(v.location::extensions.geometry),
         extensions.st_x(v.location::extensions.geometry)
  from public.events e
  join public.venues v on v.id = e.venue_id
  where public.is_tonight(e.starts_at, e.ends_at)
    and extensions.st_dwithin(
      v.location,
      extensions.st_setsrid(extensions.st_makepoint(origin_lng, origin_lat), 4326)::extensions.geography,
      least(greatest(radius_m, 100), 50000)
    )
  order by e.starts_at, 12
  limit 100
$$;

revoke all on function public.toggle_reaction(uuid) from public, anon;
revoke all on function public.friends_feed() from public, anon;
revoke all on function public.is_member(uuid) from public, anon;
revoke all on function public.open_direct_conversation(uuid) from public, anon;
revoke all on function public.my_conversations() from public, anon;
revoke all on function public.conversation_messages(uuid) from public, anon;
revoke all on function public.send_message(uuid, text) from public, anon;
revoke all on function public.send_split_request(uuid, integer, text, text) from public, anon;
revoke all on function public.mark_split_paid(uuid) from public, anon;
grant execute on function public.toggle_reaction(uuid), public.friends_feed(), public.is_member(uuid),
  public.open_direct_conversation(uuid), public.my_conversations(), public.conversation_messages(uuid),
  public.send_message(uuid, text), public.send_split_request(uuid, integer, text, text),
  public.mark_split_paid(uuid) to authenticated;
grant execute on function public.events_tonight(double precision, double precision, integer) to anon, authenticated;

alter publication supabase_realtime add table public.messages;
