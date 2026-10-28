begin;
do $$declare u uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid(); first_id uuid:=gen_random_uuid(); second_id uuid:=gen_random_uuid(); verify_id uuid:=gen_random_uuid();begin
 insert into auth.users(id,email,raw_user_meta_data) values(u,u::text||'@invalid.test','{"phone":"991999888101"}'),(other_user,other_user::text||'@invalid.test','{"phone":"991999888102"}');
 insert into auth.sessions(id,user_id,created_at) values(first_id,u,now()-interval '2 minutes'),(second_id,u,now()-interval '1 minute'),(verify_id,u,now());
 execute 'set local role authenticated';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',first_id)::text,true);
 if not public.colorwin_player_session(true) then raise exception 'first claim failed';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',second_id)::text,true);
 if not public.colorwin_player_session(true) then raise exception 'second claim failed';end if;
 -- A temporary password verifier session does not claim or replace the main login.
 if not public.colorwin_player_session(false) then raise exception 'winning session failed';end if;
 if not exists(select 1 from public.profiles where id=u) then raise exception 'winning profile denied';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',first_id)::text,true);
 if public.colorwin_player_session(false) or public.colorwin_player_session(true) then raise exception 'old session reclaimed';end if;
 if exists(select 1 from public.profiles where id=u) then raise exception 'old profile access allowed';end if;
 begin perform public.colorwin_wallet('balance','{}');raise exception 'old wallet access allowed';exception when insufficient_privilege then null;end;
 begin perform public.colorwin_account_data();raise exception 'old account RPC allowed';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_user,'role','authenticated','session_id',second_id)::text,true);
 if public.colorwin_player_session(true) then raise exception 'cross-user session accepted';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',second_id)::text,true);
 if not public.colorwin_player_session(false) then raise exception 'old checks revoked winner';end if;
 execute 'reset role';
 delete from auth.sessions where id=second_id;
 if public.colorwin_player_session(false) then raise exception 'deleted session accepted';end if;
end $$;
select 'single-session tests passed' as result;
rollback;
