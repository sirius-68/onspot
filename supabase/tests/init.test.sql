begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(2);
select has_extension('postgis', 'PostGIS is installed');
select ok(
  extensions.st_dwithin(
    extensions.st_makepoint(0, 0)::extensions.geography,
    extensions.st_makepoint(0, 0.001)::extensions.geography,
    120
  ),
  'geography distance works (0.001 deg lat is about 111 m)'
);
select * from finish();
rollback;
