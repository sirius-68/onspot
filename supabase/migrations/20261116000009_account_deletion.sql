-- Account deletion from inside the app (required by Google Play for apps with accounts).
-- Deleting the auth user cascades to profile, friendships, locations, clips rows, votes
-- and reports. Clip video files are then unreachable from the app; a storage cleanup job
-- can remove orphaned files later.
create or replace function public.delete_my_account()
returns void
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
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
