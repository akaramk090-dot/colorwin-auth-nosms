begin;
do $$
declare u uuid:=gen_random_uuid();other_user uuid:=gen_random_uuid();g text;ln integer;ri bigint;req uuid;payload jsonb;r jsonb;bet_id uuid;initial_balance numeric;ns integer[];hits integer;selector text;expected integer;h bigint:=123440;proof jsonb;
begin
 insert into auth.users(id,email,raw_user_meta_data) values(u,u||'@invalid.test','{}'),(other_user,other_user||'@invalid.test','{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,1000,'test','lottery-test:'||u);
 select x into ln from unnest(array[600,300,180,60])x where x-mod(extract(epoch from clock_timestamp()),x)>15 limit 1;
 ri:=floor(extract(epoch from clock_timestamp())/ln);
 foreach g in array array['k3','5d'] loop
  req:=gen_random_uuid();payload:=jsonb_build_object('lane',ln,'round',ri,'selection',case when g='k3' then 'sum:6' else 'A:4' end,'amount',10,'request_id',req);
  select sum(amount) into initial_balance from public.account_wallet_ledger where user_id=u;
  r:=public.colorwin_lottery(g,'bet',payload);bet_id:=(r->>'accepted_id')::uuid;
  if (r->>'balance')::numeric<>initial_balance-10 then raise exception 'Debit failed';end if;
  r:=public.colorwin_lottery(g,'bet',payload);if (r->>'balance')::numeric<>initial_balance-10 then raise exception 'Duplicate debit';end if;
  begin perform public.colorwin_lottery(g,'bet',payload||'{"amount":11}');raise exception 'Duplicate mismatch accepted';exception when raise_exception then if sqlerrm<>'Request ID already used' then raise;end if;end;
  ns:=case when g='k3' then array[1,2,3] else array[4,2,3,1,0] end;
  update colorwin_private.lottery_results set numbers=ns where game=g and lane=ln and round_index=ri-1;
  update colorwin_private.lottery_bets set round_index=ri-1 where id=bet_id;
  perform colorwin_private.lottery_settle(u);perform colorwin_private.lottery_settle(u);
  if (select count(*) from public.account_wallet_ledger where reference='lottery-win:'||bet_id)<>1 then raise exception 'Win not exactly once';end if;
  if (select status from colorwin_private.lottery_bets where id=bet_id)<>'won' then raise exception 'Winning selection failed';end if;
  if (select winnings from public.account_game_records where id=bet_id)<=0 then raise exception 'Game history missing payout';end if;
  r:=public.colorwin_lottery(g,'bet',payload||jsonb_build_object('request_id',gen_random_uuid(),'selection',case when g='k3' then 'Odd' else 'A:9' end));bet_id:=(r->>'accepted_id')::uuid;
  update colorwin_private.lottery_bets set round_index=ri-1 where id=bet_id;
  perform colorwin_private.lottery_settle(u);
  if (select status from colorwin_private.lottery_bets where id=bet_id)<>'lost' or exists(select 1 from public.account_wallet_ledger where reference='lottery-win:'||bet_id) then raise exception 'Losing bet incorrectly credited';end if;
  begin perform colorwin_private.lottery_result(g,ln,ri);raise exception 'Future result exposed';exception when raise_exception then if sqlerrm<>'Result not available' then raise;end if;end;
  begin perform public.colorwin_lottery(g,'bet',payload||jsonb_build_object('request_id',gen_random_uuid(),'round',ri-1));raise exception 'Old round accepted';exception when raise_exception then if sqlerrm<>'Betting closed. Please use the next round' then raise;end if;end;
  begin perform public.colorwin_lottery(g,'bet',payload||jsonb_build_object('request_id',gen_random_uuid(),'amount',0));raise exception 'Zero amount accepted';exception when raise_exception then if sqlerrm<>'Invalid bet' then raise;end if;end;
 end loop;
 for selector,expected in select * from(values('pair:2',16),('pair:2:3',3),('different:1,2,3',6),('two:1,2',30),('Sequence',24),('triple:2',1),('Any triple',6)) t(s,n) loop
  perform colorwin_private.lottery_odds('k3',selector);
  select count(*) into hits from generate_series(1,6)a cross join generate_series(1,6)b cross join generate_series(1,6)c where colorwin_private.lottery_payout('k3',selector,array[a,b,c],10,colorwin_private.lottery_odds('k3',selector))>0;
  if hits<>expected then raise exception 'K3 combination incorrect: %, got % expected %',selector,hits,expected;end if;
 end loop;
 if colorwin_private.lottery_payout('k3','Any triple',array[2,2,3],10,34.56)<>0 then raise exception 'Triple false win';end if;
 if colorwin_private.lottery_payout('5d','Sum:Big',array[9,9,9,9,9],10,1.96)<>19.6 then raise exception 'Sum payout failed';end if;
 if colorwin_private.lottery_payout('trx-wingo','Red',array[0],10,1.96)<>14.7 then raise exception 'Split-color payout failed';end if;
 proof:=jsonb_build_object('height',h,'hash',lpad(to_hex(h),16,'0')||repeat('a',48),'ms',floor(extract(epoch from clock_timestamp())*1000));
 -- Tests are transactional; use an isolated synthetic head and rollback it.
 delete from colorwin_private.lottery_chain_head;
 perform public.colorwin_lottery_chain_sync(proof);
 r:=public.colorwin_lottery('trx-wingo','bet',jsonb_build_object('lane',60,'round',h/20,'selection','Green','amount',10,'request_id',gen_random_uuid()));bet_id:=(r->>'accepted_id')::uuid;
 perform public.colorwin_lottery_chain_sync(proof,jsonb_build_array(jsonb_build_object('lane',60,'round',h/20-1,'height',h-1,'hash',lpad(to_hex(h-1),16,'0')||repeat('a',47)||'7')));
 update colorwin_private.lottery_bets set round_index=h/20-1 where id=bet_id;
 perform colorwin_private.lottery_settle(u);perform colorwin_private.lottery_settle(u);
 if (select payout from colorwin_private.lottery_bets where id=bet_id)<>19.6 then raise exception 'TRX block payout failed';end if;
 begin perform public.colorwin_lottery_chain_sync(proof,jsonb_build_array(jsonb_build_object('lane',60,'round',h/20,'height',h+19,'hash',lpad(to_hex(h+19),16,'0')||repeat('a',47)||'7')));raise exception 'Future block accepted';exception when raise_exception then if sqlerrm<>'Invalid TRX result block' then raise;end if;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_user,'role','authenticated')::text,true);
 r:=public.colorwin_lottery('k3','load',jsonb_build_object('lane',ln));if jsonb_array_length(r->'bets')<>0 then raise exception 'Other owner bets leaked';end if;
 execute 'set local role authenticated';
 r:=public.colorwin_lottery('k3','load',jsonb_build_object('lane',ln));if jsonb_array_length(r->'bets')<>0 then raise exception 'Authenticated RPC isolation failed';end if;
 begin perform * from colorwin_private.lottery_bets;raise exception 'Private bets accessible';exception when insufficient_privilege then null;end;
 begin perform public.colorwin_lottery_chain_sync(proof);raise exception 'Player can forge blocks';exception when insufficient_privilege then null;end;
 execute 'reset role';
end $$;
rollback;
