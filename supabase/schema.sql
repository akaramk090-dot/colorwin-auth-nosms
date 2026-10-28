-- Run once in the intended Supabase project's SQL Editor as postgres.
begin;
create schema if not exists colorwin_private;
revoke all on schema colorwin_private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  public_uid integer not null unique check (public_uid between 100000 and 999999),
  display_name text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
create unique index if not exists colorwin_profiles_phone_unique on public.profiles(phone) where phone is not null;
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
drop policy if exists colorwin_own_profile on public.profiles;
create policy colorwin_own_profile on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create or replace function colorwin_private.generate_unique_uid()
returns integer language plpgsql set search_path = '' as $$
declare candidate integer;
begin
  for attempt in 1..10000 loop
    candidate := 100000 + floor(random() * 900000)::integer;
    if not exists (select 1 from public.profiles where public_uid = candidate) then
      return candidate;
    end if;
  end loop;
  raise exception 'UID allocation unavailable; retry later';
end;
$$;

create or replace function colorwin_private.create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare uid integer;
begin
  for attempt in 1..1000 loop
    uid := colorwin_private.generate_unique_uid();
    begin
      insert into public.profiles(id,phone,public_uid,display_name,last_login_at)
      values(new.id,coalesce(new.phone,new.raw_user_meta_data->>'phone'),uid,'Member' || uid,new.last_sign_in_at);
      return new;
    exception when unique_violation then
      -- Concurrent signups can choose the same candidate. Retry inside a subtransaction.
      if exists(select 1 from public.profiles where id = new.id) then return new; end if;
    end;
  end loop;
  raise exception 'UID allocation unavailable; retry later';
end;
$$;

create or replace function colorwin_private.sync_profile_auth()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles
     set phone = coalesce(new.phone,new.raw_user_meta_data->>'phone'),
         last_login_at = new.last_sign_in_at
   where id = new.id;
  return new;
end;
$$;
revoke all on function colorwin_private.generate_unique_uid() from public,anon,authenticated;
revoke all on function colorwin_private.create_profile() from public,anon,authenticated;
revoke all on function colorwin_private.sync_profile_auth() from public,anon,authenticated;
drop trigger if exists colorwin_new_user on auth.users;
create trigger colorwin_new_user after insert on auth.users
  for each row execute function colorwin_private.create_profile();
drop trigger if exists colorwin_auth_profile_sync on auth.users;
create trigger colorwin_auth_profile_sync after update of last_sign_in_at,phone on auth.users
  for each row execute function colorwin_private.sync_profile_auth();

-- Backfill any existing users without profiles, with the same collision handling.
do $$
declare u record; uid integer;
begin
  for u in select a.* from auth.users a where not exists(select 1 from public.profiles p where p.id=a.id) loop
    loop
      uid := colorwin_private.generate_unique_uid();
      begin
        insert into public.profiles(id,phone,public_uid,display_name,created_at,last_login_at)
        values(u.id,coalesce(u.phone,u.raw_user_meta_data->>'phone'),uid,'Member' || uid,u.created_at,u.last_sign_in_at);
        exit;
      exception when unique_violation then
        if exists(select 1 from public.profiles where id=u.id) then exit; end if;
      end;
    end loop;
  end loop;
end;
$$;
commit;

-- Verification (run as SQL Editor administrator):
select count(*) as profiles, count(distinct public_uid) as unique_uids,
       count(*) filter(where public_uid not between 100000 and 999999) as invalid_uids
from public.profiles;
