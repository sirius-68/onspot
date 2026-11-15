-- Phase 4: what's on at a venue, and its live door status (written by hosts in Phase 6).

create table public.events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz,
  price_text text check (char_length(price_text) <= 40),
  ticket_url text check (ticket_url is null or ticket_url ~ '^https://'),
  spots_left integer check (spots_left >= 0),
  capacity integer check (capacity > 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index events_venue_time_idx on public.events (venue_id, starts_at);

alter table public.events enable row level security;
create policy "Events are public" on public.events for select to anon, authenticated using (true);
grant select on public.events to anon, authenticated;

create table public.venue_status (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  capacity_level text not null check (capacity_level in ('quiet', 'busy', 'packed')),
  queue_minutes integer check (queue_minutes between 0 and 240),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.venue_status enable row level security;
create policy "Venue status is public" on public.venue_status for select to anon, authenticated using (true);
grant select on public.venue_status to anon, authenticated;

-- "Tonight" = starts within the next 18 hours or is still going.
create or replace function public.is_tonight(starts_at timestamptz, ends_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select starts_at < now() + interval '18 hours'
     and coalesce(ends_at, starts_at + interval '6 hours') > now()
$$;
