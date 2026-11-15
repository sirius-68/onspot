-- pgTAP tests for venues and venues_near. Runs with `supabase test db` (CI) or
-- `npm run test:db` (local Postgres, see scripts/db-test.sh).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

-- Fixtures: two venues ~100 m apart, one ~20 km away.
insert into public.venues (id, name, category, location, geofence) values
  ('00000000-0000-0000-0000-0000000000a1', 'Test Near', 'club',
    st_setsrid(st_makepoint(-0.0780, 51.5250), 4326)::geography,
    st_buffer(st_setsrid(st_makepoint(-0.0780, 51.5250), 4326)::geography, 30)),
  ('00000000-0000-0000-0000-0000000000a2', 'Test Next Door', 'bar',
    st_setsrid(st_makepoint(-0.0780, 51.5259), 4326)::geography,
    st_buffer(st_setsrid(st_makepoint(-0.0780, 51.5259), 4326)::geography, 30)),
  ('00000000-0000-0000-0000-0000000000a3', 'Test Far', 'bar',
    st_setsrid(st_makepoint(-0.3500, 51.5000), 4326)::geography,
    st_buffer(st_setsrid(st_makepoint(-0.3500, 51.5000), 4326)::geography, 30));

-- Schema guards
select has_table('public', 'venues', 'venues table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.venues'::regclass),
  'RLS is enabled on venues'
);
select throws_ok(
  $$insert into public.venues (name, category, location, geofence) values
    ('Bad pin', 'bar',
     st_setsrid(st_makepoint(-0.0780, 51.5250), 4326)::geography,
     st_buffer(st_setsrid(st_makepoint(-0.0900, 51.5300), 4326)::geography, 20))$$,
  '23514',
  null,
  'a pin outside its own geofence is rejected'
);
select throws_ok(
  $$insert into public.venues (name, category, location, geofence) values
    ('Bad category', 'casino',
     st_setsrid(st_makepoint(-0.0780, 51.5250), 4326)::geography,
     st_buffer(st_setsrid(st_makepoint(-0.0780, 51.5250), 4326)::geography, 20))$$,
  '23514',
  null,
  'unknown categories are rejected'
);

-- venues_near behaviour (restricted to the fixtures so seed data doesn't matter)
select is(
  (select array_agg(name order by distance_m) from venues_near(51.5250, -0.0780, 500)
    where id::text like '00000000-0000-0000-0000-0000000000a%'),
  array['Test Near', 'Test Next Door'],
  'returns venues inside the radius, nearest first'
);
select ok(
  not exists (select 1 from venues_near(51.5250, -0.0780, 500)
    where id = '00000000-0000-0000-0000-0000000000a3'),
  'excludes venues outside the radius'
);
select ok(
  (select distance_m between 90 and 110 from venues_near(51.5250, -0.0780, 500)
    where id = '00000000-0000-0000-0000-0000000000a2'),
  'distance is in metres'
);
select ok(
  (select abs(lat - 51.5259) < 0.00001 and abs(lng - -0.0780) < 0.00001
    from venues_near(51.5250, -0.0780, 500)
    where id = '00000000-0000-0000-0000-0000000000a2'),
  'returns lat/lng of the pin'
);
select is(
  (select count(*)::int from venues_near(51.5250, -0.0780, 500, 1)),
  1,
  'max_results limits the result count'
);
select throws_ok(
  $$select * from venues_near(95, 0, 500)$$,
  '22023',
  'invalid coordinates',
  'rejects out-of-range coordinates'
);

-- Access as the public (anon) role
set local role anon;
select ok(
  (select count(*) from public.venues where id::text like '00000000-0000-0000-0000-0000000000a%') = 3,
  'anon can read venues'
);
select throws_ok(
  $$insert into public.venues (name, category, location, geofence) values
    ('Sneaky', 'bar',
     extensions.st_setsrid(extensions.st_makepoint(-0.0780, 51.5250), 4326)::extensions.geography,
     extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(-0.0780, 51.5250), 4326)::extensions.geography, 20))$$,
  '42501',
  null,
  'anon cannot insert venues'
);
reset role;

select * from finish();
rollback;
