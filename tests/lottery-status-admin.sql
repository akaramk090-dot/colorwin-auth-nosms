begin;
do $$
declare test_key text:='test-readonly-lottery-status-key';token text;a jsonb;b jsonb;g text;ln integer;ri bigint;
 u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();batch uuid;before_count bigint;before_amount numeric;sel text[];ix integer;
begin
 update colorwin_private.lottery_status_config set salt='test-salt',key_hash=encode(extensions.digest('test-salt'||test_key,'sha256'),'hex'),failures=0,blocked_until=null,window_started=now() where singleton;
 if has_function_privilege('anon','public.colorwin_lottery_status(text,jsonb)','execute') or
    has_function_privilege('authenticated','public.colorwin_lottery_status(text,jsonb)','execute') or
    has_table_privilege('anon','colorwin_private.lottery_status_config','select') or
    has_table_privilege('authenticated','colorwin_private.lottery_status_sessions','select') then raise exception 'Panel access exposed';end if;
 execute 'set local role service_role';
 a:=public.colorwin_lottery_status('login','{"key":"incorrect-test-key"}');if a->>'code'<>'invalid_key' then raise exception 'Incorrect key accepted';end if;
 a:=public.colorwin_lottery_status('login',jsonb_build_object('key',test_key));token:=a->>'session';
 if token is null or token !~ '^[a-f0-9]{64}$' then raise exception 'Valid login failed';end if;
 a:=public.colorwin_lottery_status('set_result',jsonb_build_object('session',token));if a->>'code'<>'unsupported' then raise exception 'Write operation allowed';end if;
 execute 'reset role';
 insert into auth.users(id,email,raw_user_meta_data) values(u,u||'@invalid.test','{}'),(v,v||'@invalid.test','{}');
 foreach g in array array['wingo','k3','5d','trx-wingo'] loop
  foreach ln in array case when g='wingo' then array[30,60,180,300] else array[60,180,300,600] end loop
   ri:=floor(extract(epoch from clock_timestamp())/ln)-200;
   execute 'set local role service_role';a:=public.colorwin_lottery_status('status',jsonb_build_object('session',token,'game',g,'lane',ln,'round',ri));execute 'reset role';
   before_count:=(a->'totals'->>'bets')::bigint;before_amount:=(a->'totals'->>'amount')::numeric;
   if a->>'ok'<>'true' then raise exception 'Status request failed: %',a;end if;
   sel:=case g when 'wingo' then array['Big','Small','7'] when 'k3' then array['Small','Big','sum:6'] when '5d' then array['A:Small','A:Big','B:3'] else array['Green','Red','5'] end;
   batch:=gen_random_uuid();
   if g<>'wingo' then insert into colorwin_private.lottery_requests(user_id,request_id,payload) values(u,batch,'{}');end if;
   for ix in 1..3 loop
    if g='wingo' then insert into colorwin_private.wingo_bets(user_id,request_id,lane,round_index,selection,stake)
     values(case when ix=3 then v else u end,gen_random_uuid(),ln,ri,sel[ix],(array[70,20,10])[ix]);
    else insert into colorwin_private.lottery_bets(user_id,request_id,game,lane,round_index,selection,stake,odds,batch_request_id)
     values(case when ix=3 then v else u end,gen_random_uuid(),g,ln,ri,sel[ix],(array[70,20,10])[ix],1.96,case when ix<3 then batch else null end);
    end if;
   end loop;
   execute 'set local role service_role';a:=public.colorwin_lottery_status('status',jsonb_build_object('session',token,'game',g,'lane',ln,'round',ri));execute 'reset role';
   if (a->'totals'->>'bets')::bigint<>before_count+3 or (a->'totals'->>'amount')::numeric<>before_amount+100 then raise exception 'Incorrect totals for % %',g,ln;end if;
   if (select sum((x->>'bets')::integer) from jsonb_array_elements(a->'selections')x)<>(a->'totals'->>'bets')::bigint or
      (select sum((x->>'amount')::numeric) from jsonb_array_elements(a->'selections')x)<>(a->'totals'->>'amount')::numeric then raise exception 'Selection percentages cannot reconcile';end if;
   if jsonb_array_length(a->'overview')<>4 or a->>'read_only'<>'true' or a::text like '%'||u::text||'%' or a::text like '%'||v::text||'%' then raise exception 'Overview missing or player identity leaked';end if;
   execute 'set local role service_role';b:=public.colorwin_lottery_status('status',jsonb_build_object('session',token,'game',g,'lane',ln,'round',ri+201));execute 'reset role';
   if b->>'code'<>'invalid_round' then raise exception 'Future round accepted';end if;
  end loop;
 end loop;
 execute 'set local role service_role';a:=public.colorwin_lottery_status('logout',jsonb_build_object('session',token));
 a:=public.colorwin_lottery_status('status',jsonb_build_object('session',token));if a->>'code'<>'unauthorized' then raise exception 'Revoked token still accepted';end if;
 for ix in 1..15 loop perform public.colorwin_lottery_status('login','{"key":"incorrect-test-key"}');end loop;
 a:=public.colorwin_lottery_status('login',jsonb_build_object('key',test_key));if a->>'code'<>'rate_limited' then raise exception 'Rate limit failed';end if;
 execute 'reset role';
end $$;
rollback;
