begin;

delete from colorwin_private.admin_key_sessions;
delete from colorwin_private.admin_panel_keys;
delete from colorwin_private.admin_key_attempts;
insert into auth.users(id,email,raw_user_meta_data)
values('d2000000-0000-4000-8000-000000000001','cw-panel-owner@invalid.test','{"phone":"994000000002"}');
insert into colorwin_private.admin_members(user_id,role)
values('d2000000-0000-4000-8000-000000000001','owner');
update colorwin_private.admin_token_config
set token_hash=extensions.crypt('SuperadminFixtureKey1234',extensions.gen_salt('bf',10)),
 token_hash_scheme='bcrypt',
 updated_by='d2000000-0000-4000-8000-000000000001',version=version+1;
insert into colorwin_private.admin_panel_keys(panel_scope,token_hash,updated_by)
values('finance',extensions.crypt('FinanceFixtureKey12345',extensions.gen_salt('bf',10)),'d2000000-0000-4000-8000-000000000001');
create temporary table panel_test_sessions(name text,token text);
grant all on panel_test_sessions to service_role;

set local role anon;
do $$begin
 begin
  perform public.colorwin_admin_key_gateway('panel_status',null,'{"panel":"finance"}');
  raise exception 'FAIL: anonymous direct gateway';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.colorwin_admin_token('status',null,null);
  raise exception 'FAIL: direct account token RPC remains available';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;

set local role service_role;
do $$declare r jsonb;master_session text;finance_session text;generated_key text;rotated_key text;ff_key text;ff_session text;support_key text;support_session text;begin
 r:=public.colorwin_admin_key_gateway('panel_status',null,'{"panel":"finance"}');
 if r->>'configured'<>'true' then raise exception 'FAIL: panel setup status';end if;
 r:=public.colorwin_admin_key_gateway('unlock',null,'{"panel":"superadmin","key":"SuperadminFixtureKey1234"}');
 master_session:=r->>'session';
 if master_session is null or r->>'panel'<>'superadmin' then raise exception 'FAIL: superadmin unlock';end if;
 insert into panel_test_sessions values('master',master_session);
 r:=public.colorwin_admin_key_gateway('list',master_session,'{"p_section":"overview"}');
 if r->>'ok'='false' then raise exception 'FAIL: superadmin overview unavailable';end if;
 r:=public.colorwin_admin_key_gateway('list',master_session,'{"p_section":"users"}');
 if r->>'ok'<>'false' or r->>'error' not like 'ADMIN_PANEL_FORBIDDEN:%' then raise exception 'FAIL: superadmin key escaped its panel';end if;
 r:=public.colorwin_admin_key_gateway('keys',master_session,'{}');
 if jsonb_array_length(r->'panels')<>4 or r::text like '%token_hash%' then raise exception 'FAIL: panel key metadata leaks or is incomplete';end if;

 r:=public.colorwin_admin_key_gateway('unlock',null,'{"panel":"finance","key":"FinanceFixtureKey12345"}');
 finance_session:=r->>'session';
 if finance_session is null or r->>'panel'<>'finance' then raise exception 'FAIL: finance unlock';end if;
 insert into panel_test_sessions values('finance',finance_session);
 r:=public.colorwin_admin_key_gateway('list',finance_session,'{"p_section":"deposits"}');
 if r->>'ok'='false' then raise exception 'FAIL: finance panel could not list deposits';end if;
 r:=public.colorwin_admin_key_gateway('list',finance_session,'{"p_section":"users"}');
 if r->>'ok'<>'false' then raise exception 'FAIL: finance key read another panel';end if;
 r:=public.colorwin_admin_key_gateway('action',finance_session,'{"p_action":"gift_create","p_data":{},"p_reason":"scope test"}');
 if r->>'ok'<>'false' then raise exception 'FAIL: finance key performed a gift action';end if;
 r:=public.colorwin_admin_key_gateway('provision',finance_session,'{"panel":"users"}');
 if r->>'ok'<>'false' then raise exception 'FAIL: finance key generated another panel key';end if;

 r:=public.colorwin_admin_key_gateway('provision',master_session,'{"panel":"gifts_users"}');
 generated_key:=r->>'key';
 r:=public.colorwin_admin_key_gateway('unlock',null,jsonb_build_object('panel','gifts_users','key',generated_key));
 ff_session:=r->>'session';
 if ff_session is null then raise exception 'FAIL: Gift Codes & Users panel key unlock';end if;
 r:=public.colorwin_admin_key_gateway('list',ff_session,'{"p_section":"gifts"}');
 if r->>'ok'='false' then raise exception 'FAIL: Gift Codes & Users panel gifts unavailable';end if;
 r:=public.colorwin_admin_key_gateway('list',ff_session,'{"p_section":"users"}');
 if r->>'ok'='false' then raise exception 'FAIL: Gift Codes & Users panel users unavailable';end if;

 r:=public.colorwin_admin_key_gateway('provision',master_session,'{"panel":"ff"}');
 ff_key:=r->>'key';
 r:=public.colorwin_admin_key_gateway('unlock',null,jsonb_build_object('panel','ff','key',ff_key));
 ff_session:=r->>'session';
 if ff_session is null then raise exception 'FAIL: FF panel key unlock';end if;
 r:=public.colorwin_admin_key_gateway('list',ff_session,'{"p_section":"tournaments"}');
 if r->>'ok'='false' then raise exception 'FAIL: FF panel tournaments unavailable';end if;
 r:=public.colorwin_admin_key_gateway('list',ff_session,'{"p_section":"entries"}');
 if r->>'ok'='false' then raise exception 'FAIL: FF panel players/rewards unavailable';end if;

 r:=public.colorwin_admin_key_gateway('provision',master_session,'{"panel":"support"}');
 support_key:=r->>'key';
 r:=public.colorwin_admin_key_gateway('unlock',null,jsonb_build_object('panel','support','key',support_key));
 support_session:=r->>'session';
 if support_session is null then raise exception 'FAIL: combined support panel key unlock';end if;
 r:=public.colorwin_admin_key_gateway('list',support_session,'{"p_section":"support"}');
 if r->>'ok'='false' then raise exception 'FAIL: support list unavailable';end if;
 r:=public.colorwin_admin_key_gateway('list',support_session,'{"p_section":"feedback"}');
 if r->>'ok'='false' then raise exception 'FAIL: feedback list unavailable';end if;
 r:=public.colorwin_admin_key_gateway('list',support_session,'{"p_section":"announcements"}');
 if r->>'ok'='false' then raise exception 'FAIL: announcements list unavailable';end if;

 r:=public.colorwin_admin_key_gateway('provision',master_session,'{"panel":"finance"}');
 generated_key:=r->>'key';
 if r->>'ok'<>'true' or length(generated_key)<>64 then raise exception 'FAIL: owner key generation';end if;
 if not exists(select 1 from colorwin_private.admin_panel_keys where panel_scope='finance' and token_hash<>generated_key) then raise exception 'FAIL: generated key was not stored as a hash';end if;
 r:=public.colorwin_admin_key_gateway('list',finance_session,'{"p_section":"deposits"}');
 if r->>'ok'<>'false' then raise exception 'FAIL: key rotation did not revoke previous panel session';end if;
 r:=public.colorwin_admin_key_gateway('unlock',null,'{"panel":"finance","key":""}');
 if r->>'ok'<>'false' then raise exception 'FAIL: invalid key accepted';end if;
 r:=public.colorwin_admin_key_gateway('unlock',null,jsonb_build_object('panel','finance','key',generated_key));
 rotated_key:=r->>'session';
 if rotated_key is null then raise exception 'FAIL: generated key could not unlock its panel';end if;
 r:=public.colorwin_admin_key_gateway('status',rotated_key,'{}');
 if r->>'panel'<>'finance' then raise exception 'FAIL: session scope not retained';end if;
 perform public.colorwin_admin_key_gateway('lock',rotated_key,'{}');
 r:=public.colorwin_admin_key_gateway('status',rotated_key,'{}');
 if r->>'ok'<>'false' then raise exception 'FAIL: logout did not revoke session';end if;
end $$;
reset role;

select 'PASS: owner-only key management, hashed panel keys, isolated list/actions, independent rotation and session revocation' as verification;
rollback;
