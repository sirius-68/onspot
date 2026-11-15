-- Local development seed: SAMPLE venues with made-up names around a dev area
-- (London, Shoreditch). Replace with real partner venues once the launch city is chosen.

insert into public.venues (name, category, location, geofence, address, price_band, music_tags)
select
  v.name,
  v.category,
  extensions.st_setsrid(extensions.st_makepoint(v.lng, v.lat), 4326)::extensions.geography,
  extensions.st_buffer(
    extensions.st_setsrid(extensions.st_makepoint(v.lng, v.lat), 4326)::extensions.geography,
    v.radius_m
  ),
  v.address,
  v.price_band,
  v.music_tags
from (values
  ('Neon Basement',      'club',       51.5263, -0.0779, 40, 'Sample St 1',  3, array['house', 'techno']),
  ('The Velvet Room',    'lounge',     51.5249, -0.0795, 30, 'Sample St 2',  3, array['rnb', 'soul']),
  ('Afro Heat Club',     'club',       51.5232, -0.0766, 45, 'Sample St 3',  2, array['afrobeats', 'amapiano']),
  ('Corner Pint',        'bar',        51.5241, -0.0752, 25, 'Sample St 4',  1, array['indie']),
  ('Rooftop 9',          'bar',        51.5258, -0.0812, 35, 'Sample St 5',  3, array['disco', 'house']),
  ('Low Light Jazz',     'live_music', 51.5225, -0.0798, 30, 'Sample St 6',  2, array['jazz']),
  ('Warehouse Sundays',  'day_party',  51.5279, -0.0745, 60, 'Sample St 7',  2, array['house', 'garage']),
  ('Pop-Up Garden',      'pop_up',     51.5217, -0.0731, 50, 'Sample St 8',  1, array['hiphop']),
  ('Bassline Arches',    'club',       51.5271, -0.0828, 45, 'Sample St 9',  2, array['dnb', 'garage']),
  ('Little Karaoke',     'bar',        51.5236, -0.0821, 25, 'Sample St 10', 1, array['pop']),
  ('Gold Tooth Lounge',  'lounge',     51.5254, -0.0738, 30, 'Sample St 11', 4, array['hiphop', 'rnb']),
  ('Late Kitchen Disco', 'club',       51.5212, -0.0779, 40, 'Sample St 12', 2, array['disco'])
) as v(name, category, lat, lng, radius_m, address, price_band, music_tags);
