begin;do $$ declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();t uuid;d jsonb;begin
insert into auth.users(id,email,raw_user_meta_data) values(u,u||'@invalid.test','{"phone":"99187345501"}'),(v,v||'@invalid.test','{"phone":"99187345502"}');
insert into public.cw_tournaments(title,game,mode,status,capacity,starts_at) values('Live notice fixture','ff','Solo','open',48,now()) returning id into t;
insert into public.cw_tournament_entries(tournament_id,user_id,player_id,player_name,status) values(t,u,'1234567','Registered','joined'),(t,v,'1234568','Cancelled','cancelled');
update public.cw_tournaments set status='live' where id=t;
if (select count(*) from colorwin_private.tournament_live_notices where tournament_id=t)<>1 then raise exception 'Wrong recipients';end if;
if (select count(*) from public.account_notifications where user_id=u and title='Your tournament is LIVE!')<>1 then raise exception 'Persistent notification missing';end if;
update public.cw_tournaments set title='Updated live title' where id=t;update public.cw_tournaments set status='live' where id=t;
if (select count(*) from colorwin_private.tournament_live_notices where tournament_id=t)<>1 then raise exception 'Duplicate alert';end if;
perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);execute 'set local role authenticated';
d:=public.colorwin_live_match_notices();if not exists(select 1 from jsonb_array_elements(d)x where x->>'tournament_id'=t::text) then raise exception 'Registered user did not get live notice';end if;execute 'reset role';
perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated')::text,true);d:=public.colorwin_live_match_notices();if exists(select 1 from jsonb_array_elements(d)x where x->>'tournament_id'=t::text) then raise exception 'Cancelled user received notice';end if;
update public.cw_tournaments set status='completed' where id=t;
perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);d:=public.colorwin_live_match_notices();if exists(select 1 from jsonb_array_elements(d)x where x->>'tournament_id'=t::text) then raise exception 'Completed match still advertised live';end if;
end $$;rollback;
