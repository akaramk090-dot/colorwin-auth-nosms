begin;
create table colorwin_private.player_sessions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 session_id uuid not null,
 signed_in_at timestamptz not null
);
alter table colorwin_private.player_sessions enable row level security;
revoke all on colorwin_private.player_sessions from public,anon,authenticated;
create function colorwin_private.player_session_allowed() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
 not exists(select 1 from colorwin_private.player_sessions where user_id=auth.uid()) or
 exists(select 1 from colorwin_private.player_sessions p join auth.sessions s on s.id=p.session_id and s.user_id=p.user_id
 where p.user_id=auth.uid() and p.session_id::text=auth.jwt()->>'session_id' and (s.not_after is null or s.not_after>now())));
$$;
revoke all on function colorwin_private.player_session_allowed() from public,anon;
grant execute on function colorwin_private.player_session_allowed() to authenticated;
create function colorwin_private.player_session(p_claim boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); sid uuid; started timestamptz; previous colorwin_private.player_sessions;
begin
 if u is null then raise exception 'Sign in to continue' using errcode='42501';end if;
 sid:=nullif(auth.jwt()->>'session_id','')::uuid;
 select created_at into started from auth.sessions where id=sid and user_id=u and (not_after is null or not_after>now());
 if started is null then return false;end if;
 if p_claim then
  perform pg_advisory_xact_lock(hashtextextended(u::text,8701));
  select * into previous from colorwin_private.player_sessions where user_id=u;
  if found and previous.session_id<>sid and (previous.signed_in_at,previous.session_id)>=(started,sid) then return false;end if;
  insert into colorwin_private.player_sessions values(u,sid,started) on conflict(user_id) do update set session_id=excluded.session_id,signed_in_at=excluded.signed_in_at;
 end if;
 return colorwin_private.player_session_allowed();
end $$;
revoke all on function colorwin_private.player_session(boolean) from public,anon,authenticated;
create function public.colorwin_player_session(p_claim boolean default false) returns boolean language sql security invoker set search_path='' as $$select colorwin_private.player_session(p_claim)$$;
revoke all on function public.colorwin_player_session(boolean) from public,anon;
grant execute on function colorwin_private.player_session(boolean),public.colorwin_player_session(boolean) to authenticated;
create function colorwin_private.assert_player_session() returns void language plpgsql security definer set search_path='' as $$
begin
 if not colorwin_private.player_session_allowed() then raise exception 'SESSION_REPLACED: Account signed in on another device' using errcode='42501';end if;
end $$;
revoke all on function colorwin_private.assert_player_session() from public,anon,authenticated;
-- Preserve the independent, server-validated admin access-key gateway.
create or replace function colorwin_private.assert_active() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();begin
 if u is null or not exists(select 1 from public.profiles where id=u and not is_blocked) then raise exception 'Account unavailable or suspended' using errcode='42501';end if;
 if auth.jwt()->>'session_id' is not null then perform colorwin_private.assert_player_session();end if;
 return u;
end $$;
-- Sensitive legacy player RPCs run as definers, so they need an explicit gate.
do $$declare f record;definition text;begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('colorwin_account_data','colorwin_game_statistics','colorwin_redeem_gift','colorwin_set_nickname','colorwin_submit_feedback','colorwin_support_data','colorwin_support_submit') loop
  definition:=pg_get_functiondef(f.oid);
  definition:=regexp_replace(definition,'\mbegin\M','begin perform colorwin_private.assert_player_session();','i');
  execute definition;
 end loop;
end $$;
-- Restrictive policies combine with existing ownership policies rather than replacing them.
do $$declare t record;begin
 for t in select tablename from pg_tables where schemaname='public' and rowsecurity loop
  execute format('create policy cw_active_player_session on public.%I as restrictive for all to authenticated using ((select colorwin_private.player_session_allowed())) with check ((select colorwin_private.player_session_allowed()))',t.tablename);
 end loop;
end $$;
commit;
