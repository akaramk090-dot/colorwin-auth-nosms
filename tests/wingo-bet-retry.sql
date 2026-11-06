begin;
do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();req uuid:=gen_random_uuid();ln integer:=300;ri bigint;a jsonb;b jsonb;params jsonb;expected numeric;
begin
 insert into auth.users(id,email,raw_user_meta_data) values(u,u||'@invalid.test','{}'),(v,v||'@invalid.test','{}');
 insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,100,'test','wingo-http-fix-test:'||u);
 ri:=floor(extract(epoch from clock_timestamp())/ln);
 if (ri+1)*ln-extract(epoch from clock_timestamp())<=5 then raise exception 'Retry this test after the closing countdown';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);execute 'set local role authenticated';
 params:=jsonb_build_object('lane',ln,'round',ri,'selection','Big','amount',1,'request_id',req);
 a:=public.colorwin_wingo('bet',params);b:=public.colorwin_wingo('bet',params);
 if (a->>'balance')::numeric<>99 or (b->>'balance')::numeric<>99 or jsonb_array_length(b->'bets')<>1 then raise exception 'WinGo duplicate debit or failed acceptance';end if;
 b:=public.colorwin_wingo('bet',params||jsonb_build_object('selection','Small','request_id',gen_random_uuid()));
 if (b->>'balance')::numeric<>98 or jsonb_array_length(b->'bets')<>2 then raise exception 'Second WinGo bet failed';end if;
 execute 'reset role';perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated')::text,true);execute 'set local role authenticated';
 b:=public.colorwin_wingo('load',jsonb_build_object('lane',ln));if jsonb_array_length(b->'bets')<>0 then raise exception 'WinGo history leaked to other user';end if;
 execute 'reset role';update colorwin_private.wingo_bets set round_index=ri-2 where user_id=u;
 perform colorwin_private.wingo_settle(u);perform colorwin_private.wingo_settle(u);
 if (select count(*) from colorwin_private.wingo_bets where user_id=u and status='won')<>1 or (select count(*) from colorwin_private.wingo_bets where user_id=u and status='lost')<>1 then raise exception 'Mixed WinGo result failed';end if;
 select sum(payout) into expected from colorwin_private.wingo_bets where user_id=u;
 if (select sum(amount) from public.account_wallet_ledger where user_id=u)<>98+expected then raise exception 'WinGo settlement wallet incorrect';end if;
end $$;
rollback;
