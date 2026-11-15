begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(13);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.dev'),
  ('33333333-3333-3333-3333-333333333333', 'c@test.dev');
insert into public.profiles (id, username, birthdate) values
  ('11111111-1111-1111-1111-111111111111', 'alice', '1995-01-01'),
  ('22222222-2222-2222-2222-222222222222', 'bob', '1996-02-02');

insert into public.venues (id, name, category, location, geofence) values
  ('00000000-0000-0000-0000-0000000000c1', 'Clip Club', 'club',
    st_setsrid(st_makepoint(-0.0780, 51.5250), 4326)::geography,
    st_buffer(st_setsrid(st_makepoint(-0.0780, 51.5250), 4326)::geography, 30));

-- No profile, no posting.
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select throws_ok(
  $$select * from create_clip('00000000-0000-0000-0000-0000000000c1', 51.5250, -0.0780, 12, now(), 8)$$,
  'P0001', 'profile_required', 'users without an 18+ profile cannot post'
);
reset role;

-- Act as user A.
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select lives_ok(
  $$select * from create_clip('00000000-0000-0000-0000-0000000000c1', 51.5250, -0.0780, 12, now(), 8)$$,
  'a clip shot inside the venue is accepted'
);
select lives_ok(
  $$select * from create_clip('00000000-0000-0000-0000-0000000000c1', 51.52545, -0.0780, 40, now(), 8)$$,
  'a clip just outside the geofence but within GPS accuracy is accepted'
);
select throws_ok(
  $$select * from create_clip('00000000-0000-0000-0000-0000000000c1', 51.5300, -0.0780, 10, now(), 8)$$,
  'P0001', 'outside_venue', 'a clip 550 m away is rejected'
);
select throws_ok(
  $$select * from create_clip('00000000-0000-0000-0000-0000000000c1', 51.5300, -0.0780, 5000, now(), 8)$$,
  'P0001', 'outside_venue', 'a huge accuracy radius does not stretch the geofence beyond 75 m'
);
select throws_ok(
  $$select * from create_clip('00000000-0000-0000-0000-0000000000c1', 51.5250, -0.0780, 10, now() - interval '10 minutes', 8)$$,
  'P0001', 'stale_capture', 'an old capture time is rejected'
);

-- Pending clips are invisible to others and can't go live without the file.
select is(
  (select storage_path like '11111111-1111-1111-1111-111111111111/%.mp4' from clips limit 1),
  true, 'storage path sits in the author''s folder'
);
select throws_ok(
  format('select finalize_clip(%L)', (select id from clips order by received_at limit 1)),
  'P0001', 'upload_missing', 'cannot publish before the file is uploaded'
);

reset role;
insert into storage.objects (bucket_id, name)
  select 'clips', storage_path from clips order by received_at limit 1;
set local role authenticated;

select lives_ok(
  format('select finalize_clip(%L)', (select id from clips order by received_at limit 1)),
  'publishes once the file exists'
);
select is(
  (select count(*)::int from venue_live_clips('00000000-0000-0000-0000-0000000000c1')),
  1, 'the published clip is live on the venue'
);

-- Another user sees only live clips and cannot publish someone else's.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select is((select count(*)::int from clips), 1, 'others see only live clips');
select throws_ok(
  format('select finalize_clip(%L)', (select id from clips limit 1)),
  'P0001', 'unknown_clip', 'cannot finalize another user''s clip'
);

-- Clips older than 60 minutes drop out of Live.
reset role;
update clips set published_at = now() - interval '61 minutes' where status = 'live';
select is(
  (select count(*)::int from venue_live_clips('00000000-0000-0000-0000-0000000000c1')),
  0, 'clips leave Live after 60 minutes'
);

select * from finish();
rollback;
