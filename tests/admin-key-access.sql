begin;
delete from colorwin_private.admin_key_sessions;
delete from colorwin_private.admin_key_attempts;
insert into auth.users(id,email,raw_user_meta_data) values('d1000000-0000-4000-8000-000000000001','cw-key-owner@invalid.test','{"phone":"994000000001"}');
insert into colorwin_private.admin_members(user_id,role) values('d1000000-0000-4000-8000-000000000001','owner');
update colorwin_private.admin_token_config set token_hash=extensions.crypt('FixtureKeyAccess1234',extensions.gen_salt('bf',10)),updated_by='d1000000-0000-4000-8000-000000000001',version=version+1;
create temporary table key_test_sessions(name text,token text);
grant all on key_test_sessions to service_role;
set local role anon;
do $$begin
 begin perform public.colorwin_admin_key_gateway('unlock',null,'{"key":"FixtureKeyAccess1234"}');raise exception 'FAIL: anonymous direct database gateway';exception when insufficient_privilege then null;end;
 begin perform public.colorwin_admin_list();raise exception 'FAIL: anonymous old admin RPC';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role service_role;
do $$declare r jsonb;a text;b text;begin
 r:=public.colorwin_admin_key_gateway('unlock',null,'{"key":"WrongKeyAccess123456"}');if r->>'ok'<>'false' then raise exception 'FAIL: wrong key';end if;
 r:=public.colorwin_admin_key_gateway('unlock',null,'{"key":"FixtureKeyAccess1234"}');a:=r->>'session';if a is null then raise exception 'FAIL: no session';end if;
 r:=public.colorwin_admin_key_gateway('unlock',null,'{"key":"FixtureKeyAccess1234"}');b:=r->>'session';
 insert into key_test_sessions values('first',a),('second',b);
 foreach r in array array[public.colorwin_admin_key_gateway('list',a,'{"p_section":"overview"}'),public.colorwin_admin_key_gateway('list',a,'{"p_section":"users"}')] loop
  if r is null then raise exception 'FAIL: records unavailable';end if;
 end loop;
 begin perform public.colorwin_admin_key_gateway('action',a,'{"p_action":"announcement","p_data":{"title":"Test key","message":"Test key announcement","active":false},"p_reason":""}');raise exception 'FAIL: empty reason';exception when raise_exception then if sqlerrm='FAIL: empty reason' then raise;end if;end;
 perform public.colorwin_admin_key_gateway('action',a,'{"p_action":"announcement","p_data":{"title":"Test key","message":"Test key announcement","active":false},"p_reason":"Key gateway action test"}');
 if auth.uid() is not null then raise exception 'FAIL: actor identity escaped gateway';end if;
 r:=public.colorwin_admin_key_gateway('rotate',a,'{"token":"NewFixtureKey123456","current":"IncorrectCurrentKey123"}');if r->>'ok'<>'false' then raise exception 'FAIL: rotation accepted wrong key';end if;
 r:=public.colorwin_admin_key_gateway('rotate',a,'{"token":"NewFixtureKey123456","current":"FixtureKeyAccess1234"}');if r->>'ok'<>'true' then raise exception 'FAIL: rotation failed';end if;
 r:=public.colorwin_admin_key_gateway('list',b,'{}');if r->>'ok'<>'false' then raise exception 'FAIL: other session not revoked';end if;
 r:=public.colorwin_admin_key_gateway('unlock',null,'{"key":"FixtureKeyAccess1234"}');if r->>'ok'<>'false' then raise exception 'FAIL: old key accepted';end if;
 perform public.colorwin_admin_key_gateway('lock',a,'{}');
 r:=public.colorwin_admin_key_gateway('list',a,'{}');if r->>'ok'<>'false' then raise exception 'FAIL: logout not revoked';end if;
end $$;
reset role;
do $$declare r jsonb;s text;begin
 r:=public.colorwin_admin_key_gateway('unlock',null,'{"key":"NewFixtureKey123456"}');s:=r->>'session';
 update public.profiles set is_blocked=true where id='d1000000-0000-4000-8000-000000000001';
 r:=public.colorwin_admin_key_gateway('list',s,'{}');if r->>'ok'<>'false' then raise exception 'FAIL: suspended owner entered';end if;
 update public.profiles set is_blocked=false where id='d1000000-0000-4000-8000-000000000001';
 update colorwin_private.admin_key_sessions set expires_at=now()-interval '1 second';
 r:=public.colorwin_admin_key_gateway('list',s,'{}');if r->>'ok'<>'false' then raise exception 'FAIL: expired session accepted';end if;
 if exists(select 1 from colorwin_private.admin_key_sessions where session_hash=s) then raise exception 'FAIL: session secret stored plaintext';end if;
 update colorwin_private.admin_key_attempts set attempts=20 where bucket='unlock';
 r:=public.colorwin_admin_key_gateway('unlock',null,'{"key":"NewFixtureKey123456"}');if r->>'error' not like 'Too many%' then raise exception 'FAIL: unlock rate limit';end if;
end $$;
select 'PASS: service-only gateway, direct key unlock, records, mutation, reason validation, scoped identity, rotation, revocation, expiry, hashing, throttle' as verification;
rollback;
