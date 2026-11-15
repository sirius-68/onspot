-- Profiles (18+), friends, friends-only location, Ghost Mode, block, report.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(21);

insert into auth.users (id, email, is_anonymous) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'amy@test.dev', false),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'ben@test.dev', false),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'cat@test.dev', false),
  ('aaaaaaaa-0000-0000-0000-000000000004', null, true);

-- Profiles
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
set local role authenticated;
select throws_ok($$select upsert_my_profile('amy', 'Amy', (now() - interval '17 years')::date)$$,
  'P0001', 'under_18', 'under-18 birthdates are refused');
select throws_ok($$select upsert_my_profile('A!', 'Amy', '1995-05-05')$$,
  'P0001', 'invalid_username', 'usernames are validated');
select lives_ok($$select upsert_my_profile('Amy', 'Amy', '1995-05-05')$$, 'adult can create a profile');
select is((select username from my_profile()), 'amy', 'usernames are stored lowercase');
select throws_ok($$select birthdate from profiles$$, '42501', null, 'birthdates are not readable');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000004', true);
select throws_ok($$select upsert_my_profile('anon1', null, '1990-01-01')$$,
  'P0001', 'account_required', 'anonymous sessions must sign up first');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', true);
select lives_ok($$select upsert_my_profile('ben', null, '1994-04-04')$$, 'second user');
select throws_ok($$select upsert_my_profile('amy', null, '1994-04-04')$$,
  'P0001', 'username_taken', 'usernames are unique');
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000003', true);
select lives_ok($$select upsert_my_profile('cat', null, '1993-03-03')$$, 'third user');

-- Friends: Amy asks Ben, Ben accepts.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
select is(send_friend_request('ben'), 'requested', 'friend request sent');
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', true);
select is((select state from my_friends() where username = 'amy'), 'incoming', 'Ben sees an incoming request');
select lives_ok(
  format('select respond_friend_request(%L, true)', (select request_id from my_friends() where username = 'amy')),
  'Ben accepts'
);

-- Locations: Ben shares; Amy (friend) sees him, Cat (stranger) doesn't.
select lives_ok($$select update_my_location(51.52, -0.07, 20)$$, 'Ben shares location');
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
select is((select count(*)::int from friends_locations()), 1, 'a friend sees the location');
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000003', true);
select is((select count(*)::int from friends_locations()), 0, 'a stranger does not');
select throws_ok($$select * from user_locations$$, '42501', null, 'the locations table is not readable directly');

-- Ghost Mode hides Ben at once.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', true);
select set_ghost_mode(true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
select is((select count(*)::int from friends_locations()), 0, 'Ghost Mode hides the location immediately');

-- Blocking removes the friendship and blocks new requests.
select block_user('aaaaaaaa-0000-0000-0000-000000000002');
select is((select count(*)::int from my_friends()), 0, 'blocking removes the friendship');
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', true);
select throws_ok($$select send_friend_request('amy')$$, 'P0001', 'unknown_user',
  'a blocked user cannot send a new request');

-- Account deletion removes the user and everything tied to them.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000003', true);
select lives_ok($$select delete_my_account()$$, 'a user can delete their account');
reset role;
select is((select count(*)::int from profiles where id = 'aaaaaaaa-0000-0000-0000-000000000003'), 0,
  'the profile is gone with the account');

select * from finish();
rollback;
