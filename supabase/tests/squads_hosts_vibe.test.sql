-- Squad vote, hosts, Spotters, reporting, Vibe Score, search.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(25);

insert into auth.users (id, email) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'host@test.dev'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'fan@test.dev'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'spot@test.dev'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'r1@test.dev'),
  ('bbbbbbbb-0000-0000-0000-000000000005', 'r2@test.dev');
insert into public.profiles (id, username, birthdate, role) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'hosty', '1990-01-01', 'host'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'fan', '1990-01-01', 'user'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'spotty', '1990-01-01', 'spotter'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'rep1', '1990-01-01', 'user'),
  ('bbbbbbbb-0000-0000-0000-000000000005', 'rep2', '1990-01-01', 'user');

insert into public.venues (id, name, category, location, geofence, price_band, music_tags) values
  ('00000000-0000-0000-0000-0000000000d1', 'Zeta Club', 'club',
    st_setsrid(st_makepoint(10.0000, 10.0000), 4326)::geography,
    st_buffer(st_setsrid(st_makepoint(10.0000, 10.0000), 4326)::geography, 30), 3, array['afrobeats']),
  ('00000000-0000-0000-0000-0000000000d2', 'Zeta Bar', 'bar',
    st_setsrid(st_makepoint(10.0010, 10.0000), 4326)::geography,
    st_buffer(st_setsrid(st_makepoint(10.0010, 10.0000), 4326)::geography, 30), 1, array['jazz']),
  ('00000000-0000-0000-0000-0000000000d3', 'Zeta Lounge', 'lounge',
    st_setsrid(st_makepoint(10.0020, 10.0000), 4326)::geography,
    st_buffer(st_setsrid(st_makepoint(10.0020, 10.0000), 4326)::geography, 30), 4, array['rnb']);
insert into public.venue_hosts (venue_id, user_id) values
  ('00000000-0000-0000-0000-0000000000d1', 'bbbbbbbb-0000-0000-0000-000000000001');
insert into public.events (venue_id, title, starts_at) values
  ('00000000-0000-0000-0000-0000000000d2', 'Jazz night', now() + interval '2 hours');

-- Squads --------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', true);
set local role authenticated;
select throws_ok(
  $$select create_squad(array['00000000-0000-0000-0000-0000000000d1']::uuid[])$$,
  'P0001', 'pick_2_or_3_venues', 'a squad needs 2 or 3 venues'
);
create temp table t_squad as
  select create_squad(array['00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2']::uuid[], 'Friday') as code;
grant select on t_squad to anon;
select is(jsonb_array_length(get_squad((select code from t_squad)) -> 'options'), 2, 'squad has two options');
select lives_ok(
  format('select cast_vote(%L, %L)', (select code from t_squad),
    (get_squad((select code from t_squad)) -> 'options' -> 0 ->> 'option_id')),
  'the creator votes'
);
select lives_ok(
  format('select cast_vote(%L, %L)', (select code from t_squad),
    (get_squad((select code from t_squad)) -> 'options' -> 1 ->> 'option_id')),
  'changing your vote works'
);
select is((get_squad((select code from t_squad)) ->> 'total_votes')::int, 1, 'one person, one vote');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  format('select cast_vote(%L, %L)', (select code from t_squad),
    (get_squad((select code from t_squad)) -> 'options' -> 0 ->> 'option_id')),
  'P0001', 'guest_name_required', 'guests must give a name'
);
select lives_ok(
  format('select cast_vote(%L, %L, %L, %L)', (select code from t_squad),
    (get_squad((select code from t_squad)) -> 'options' -> 0 ->> 'option_id'), 'guest-key-1234567890', 'Dee'),
  'a guest votes from the web link'
);
select is((get_squad((select code from t_squad), 'guest-key-1234567890') ->> 'total_votes')::int, 2, 'guest vote counted');
select ok((get_squad((select code from t_squad), 'guest-key-1234567890') ->> 'my_option_id') is not null,
  'the guest sees their own vote');
select is(get_squad('nope'), null, 'unknown codes return null');
reset role;
update squads set closes_at = now() - interval '1 minute';
set local role anon;
select throws_ok(
  format('select cast_vote(%L, %L, %L, %L)', (select code from t_squad),
    (get_squad((select code from t_squad)) -> 'options' -> 0 ->> 'option_id'), 'guest-key-0987654321', 'Eve'),
  'P0001', 'voting_closed', 'closed squads take no votes'
);
reset role;

-- Hosts ---------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', true);
select throws_ok($$select set_venue_status('00000000-0000-0000-0000-0000000000d1', 'packed', 10)$$,
  '42501', 'not_venue_host', 'non-hosts cannot set door status');
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000001', true);
select lives_ok($$select set_venue_status('00000000-0000-0000-0000-0000000000d1', 'packed', 10)$$,
  'the host sets door status');
create temp table t_host_clip as select * from create_clip('00000000-0000-0000-0000-0000000000d1', 10.0, 10.0, 10, now(), 5);
select is((select source from clips where id = (select clip_id from t_host_clip)), 'host', 'host clips are labelled official');

-- Spotters ------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', true);
select throws_ok($$select * from spotter_tasks(10.0, 10.0)$$, '42501', 'spotters_only', 'only Spotters get tasks');
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000003', true);
select is((select count(*)::int from spotter_tasks(10.0, 10.0) where venue_id::text like '00000000-0000-0000-0000-0000000000d%'),
  3, 'venues without fresh clips are tasks');
create temp table t_spot_clip as select * from create_clip('00000000-0000-0000-0000-0000000000d2', 10.0, 10.001, 10, now(), 5);
select is((select source from clips where id = (select clip_id from t_spot_clip)), 'spotter', 'Spotter clips are labelled for metrics');

-- Reports hide a clip after 3 reports ----------------------------------------------------
reset role;
update clips set status = 'live', published_at = now() where venue_id = '00000000-0000-0000-0000-0000000000d1';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', true);
select report_clip((select id from clips where venue_id = '00000000-0000-0000-0000-0000000000d1'), 'spam');
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000004', true);
select report_clip((select id from clips where venue_id = '00000000-0000-0000-0000-0000000000d1'), 'spam');
select is((select count(*)::int from venue_live_clips('00000000-0000-0000-0000-0000000000d1')), 1,
  'two reports keep the clip live');

-- Vibe Score ----------------------------------------------------------------------------
reset role;
select is(vibe_score(array[0, 30]::double precision[], 'packed'), 63::smallint,
  'score = fading clip points + door status');
select is(vibe_score(array[]::double precision[], null), 0::smallint, 'no signals, no score');
select is(vibe_score(array[0,0,0,0,0,0]::double precision[], 'packed'), 100::smallint, 'score caps at 100');
select ok(compute_vibe_scores() >= 3, 'scores computed for every venue');
select is((select score from venue_vibe where venue_id = '00000000-0000-0000-0000-0000000000d1'), 55::smallint,
  'one fresh clip (15) + packed (40)');

-- Search --------------------------------------------------------------------------------
select is(
  (select array_agg(name order by distance_m) from search_venues(10.0, 10.0, 1000, null, null, 2::smallint)
    where id::text like '00000000-0000-0000-0000-0000000000d%'),
  array['Zeta Bar'], 'price filter keeps venues at or under the budget'
);
select is(
  (select array_agg(name) from search_venues(10.0, 10.0, 1000, null, null, null, null, true)
    where id::text like '00000000-0000-0000-0000-0000000000d%'),
  array['Zeta Bar'], 'tonight-only keeps venues with an event tonight'
);

select * from finish();
rollback;
