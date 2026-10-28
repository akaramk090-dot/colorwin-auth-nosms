-- All token changes, test accounts and sessions are rolled back.
begin;
delete from colorwin_private.admin_token_grants;
delete from colorwin_private.admin_token_config;
insert into auth.users(id,email,raw_user_meta_data) values
 ('e0000000-0000-4000-8000-000000000001','cw-token-owner@invalid.test','{"phone":"993000000001"}'),
 ('e0000000-0000-4000-8000-000000000002','cw-token-staff@invalid.test','{"phone":"993000000002"}'),
 ('e0000000-0000-4000-8000-000000000003','cw-token-user@invalid.test','{"phone":"993000000003"}');
insert into colorwin_private.admin_members(user_id,role) values('e0000000-0000-4000-8000-000000000001','owner'),('e0000000-0000-4000-8000-000000000002','finance');
insert into auth.sessions(id,user_id) values
 ('f0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001'),
 ('f0000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000002'),
 ('f0000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000003');
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000001","session_id":"f0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$declare result jsonb;begin
 begin perform public.colorwin_admin_list();raise exception 'FAIL: owner entered without token';exception when insufficient_privilege then null;end;
 result:=public.colorwin_admin_token('setup','FixtureToken12345678');if result->>'ok'<>'true' then raise exception 'FAIL: setup failed %',result;end if;
 perform public.colorwin_admin_list();
 begin perform * from colorwin_private.admin_token_config;raise exception 'FAIL: hash readable';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000002","session_id":"f0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$declare r jsonb;begin
 begin perform public.colorwin_admin_token('setup','StaffCannotSetup1234');raise exception 'FAIL: staff setup';exception when insufficient_privilege then null;end;
 r:=public.colorwin_admin_token('unlock','IncorrectToken123456');if r->>'ok'<>'false' then raise exception 'FAIL: wrong token accepted';end if;
 begin perform public.colorwin_admin_list();raise exception 'FAIL: staff bypassed gate';exception when insufficient_privilege then null;end;
 r:=public.colorwin_admin_token('unlock','FixtureToken12345678');if r->>'ok'<>'true' then raise exception 'FAIL: staff unlock';end if;
 perform public.colorwin_admin_list('deposits');
 begin perform public.colorwin_admin_token('rotate','ChangedToken12345678','FixtureToken12345678');raise exception 'FAIL: staff rotated token';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000003","session_id":"f0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$begin
 begin perform public.colorwin_admin_token('unlock','FixtureToken12345678');raise exception 'FAIL: user with token entered';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000001","session_id":"f0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$declare r jsonb;begin
 r:=public.colorwin_admin_token('rotate','ChangedToken12345678','WrongCurrent12345678');if r->>'ok'<>'false' then raise exception 'FAIL: wrong current token accepted';end if;
 r:=public.colorwin_admin_token('rotate','ChangedToken12345678','FixtureToken12345678');if r->>'ok'<>'true' then raise exception 'FAIL: owner rotation';end if;
 perform public.colorwin_admin_list();
end $$;
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000002","session_id":"f0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$declare r jsonb;begin
 begin perform public.colorwin_admin_list();raise exception 'FAIL: rotation did not revoke staff grant';exception when insufficient_privilege then null;end;
 r:=public.colorwin_admin_token('unlock','FixtureToken12345678');if r->>'ok'<>'false' then raise exception 'FAIL: old token accepted';end if;
 r:=public.colorwin_admin_token('unlock','ChangedToken12345678');if r->>'ok'<>'true' then raise exception 'FAIL: new token rejected';end if;
 perform public.colorwin_admin_token('lock');
 begin perform public.colorwin_admin_list();raise exception 'FAIL: logout lock failed';exception when insufficient_privilege then null;end;
 for i in 1..5 loop perform public.colorwin_admin_token('unlock','IncorrectToken123456');end loop;
 r:=public.colorwin_admin_token('unlock','ChangedToken12345678');if r->>'ok'<>'false' or r->>'error' not like 'Too many%' then raise exception 'FAIL: attempt throttling missing %',r;end if;
end $$;
reset role;
do $$begin
 if exists(select 1 from colorwin_private.admin_audit where actor='e0000000-0000-4000-8000-000000000001' and (after_data::text like '%Token1234%' or before_data::text like '%Token1234%')) then raise exception 'FAIL: plaintext token audited';end if;
 if exists(select 1 from colorwin_private.admin_token_config where token_hash='ChangedToken12345678') then raise exception 'FAIL: plaintext token stored';end if;
 delete from colorwin_private.admin_token_attempts where user_id='e0000000-0000-4000-8000-000000000002';
end $$;
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000002","session_id":"f0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select public.colorwin_admin_token('unlock','ChangedToken12345678');
delete from auth.sessions where id='f0000000-0000-4000-8000-000000000002';
set local role authenticated;
do $$begin
 begin perform public.colorwin_admin_list();raise exception 'FAIL: revoked auth session entered';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: owner setup, hash privacy, wrong token, role checks, rotation invalidation, logout locking, throttling, revoked sessions' as verification;
rollback;
