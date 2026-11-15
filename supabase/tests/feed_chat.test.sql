-- Feed reactions, chats with split requests, tonight's events.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(20);

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000001', 'ada@test.dev'),
  ('cccccccc-0000-0000-0000-000000000002', 'ben@test.dev'),
  ('cccccccc-0000-0000-0000-000000000003', 'cy@test.dev');
insert into public.profiles (id, username, birthdate) values
  ('cccccccc-0000-0000-0000-000000000001', 'ada', '1990-01-01'),
  ('cccccccc-0000-0000-0000-000000000002', 'ben', '1990-01-01'),
  ('cccccccc-0000-0000-0000-000000000003', 'cyd', '1990-01-01');
insert into public.friendships (requester_id, addressee_id, status) values
  ('cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002', 'accepted');

insert into public.venues (id, name, category, location, geofence) values
  ('00000000-0000-0000-0000-0000000000e1', 'Feed Club', 'club',
    st_setsrid(st_makepoint(20.0, 20.0), 4326)::geography,
    st_buffer(st_setsrid(st_makepoint(20.0, 20.0), 4326)::geography, 30));
insert into public.events (venue_id, title, starts_at, spots_left) values
  ('00000000-0000-0000-0000-0000000000e1', 'Tonight party', now() + interval '1 hour', 25),
  ('00000000-0000-0000-0000-0000000000e1', 'Next week', now() + interval '7 days', 10);

insert into public.clips (id, venue_id, author_id, storage_path, captured_at, lat, lng, accuracy_m, status, published_at) values
  ('00000000-0000-0000-0000-0000000c1001', '00000000-0000-0000-0000-0000000000e1',
    'cccccccc-0000-0000-0000-000000000002', 'e1/ben1.mp4', now(), 20.0, 20.0, 5, 'live', now() - interval '5 minutes'),
  ('00000000-0000-0000-0000-0000000c1002', '00000000-0000-0000-0000-0000000000e1',
    'cccccccc-0000-0000-0000-000000000003', 'e1/cy1.mp4', now(), 20.0, 20.0, 5, 'live', now() - interval '5 minutes');

-- Feed ------------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000001', true);
set local role authenticated;

select is((select count(*)::int from friends_feed()), 1, 'feed shows friends'' clips only');
select is((select username from friends_feed() limit 1), 'ben', 'feed row carries the author');
select is(toggle_reaction('00000000-0000-0000-0000-0000000c1001'), 1, 'reacting adds a fire');
select is((select i_reacted from friends_feed() limit 1), true, 'feed knows I reacted');
select is(toggle_reaction('00000000-0000-0000-0000-0000000c1001'), 0, 'reacting again removes it');

-- Chats -----------------------------------------------------------------------------------
select throws_ok(
  $$select open_direct_conversation('cccccccc-0000-0000-0000-000000000003')$$,
  'friends_only', 'only friends can chat'
);
create temp table convo as
  select open_direct_conversation('cccccccc-0000-0000-0000-000000000002') as id;
select is(
  open_direct_conversation('cccccccc-0000-0000-0000-000000000002'),
  (select id from convo), 'opening again returns the same chat'
);
select isnt(send_message((select id from convo), 'Are we going?'), null, 'sends a message');
select throws_ok(
  format($$select send_message(%L, '   ')$$, (select id from convo)),
  'empty_message', 'empty messages are rejected'
);
create temp table split as
  select send_split_request((select id from convo), 1500, 'gbp', 'Tickets') as id;
select is((select currency from messages where id = (select id from split)), 'GBP', 'currency is upper-cased');
select throws_ok(
  format($$select mark_split_paid(%L)$$, (select id from split)),
  'cannot_pay_own_request', 'you cannot mark your own request paid'
);
select is((select last_kind from my_conversations()), 'split', 'chat list shows the latest message');

-- Ben reads and pays.
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000002', true);
select is((select unread from my_conversations()), 2, 'Ben has two unread messages');
select is((select count(*)::int from conversation_messages((select id from convo))), 2, 'Ben sees both messages');
select is((select unread from my_conversations()), 0, 'reading clears unread');
select lives_ok(format($$select mark_split_paid(%L)$$, (select id from split)), 'Ben marks it paid');
select isnt((select paid_at from messages where id = (select id from split)), null, 'split is paid');

-- Outsiders see nothing.
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', true);
select is((select count(*)::int from messages), 0, 'RLS hides other people''s messages');
select throws_ok(
  format($$select conversation_messages(%L)$$, (select id from convo)),
  'not_member', 'non-members cannot read a chat'
);

-- Plans -----------------------------------------------------------------------------------
select is(
  (select array_agg(title) from events_tonight(20.0, 20.0, 1000)),
  array['Tonight party'], 'events_tonight lists only tonight''s events nearby'
);

select * from finish();
rollback;
