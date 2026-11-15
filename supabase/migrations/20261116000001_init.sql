-- Phase 0: base extensions.
-- PostGIS powers geofences ("is this clip inside the venue?") and "venues near me".
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
