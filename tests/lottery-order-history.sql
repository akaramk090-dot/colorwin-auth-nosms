begin;
do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();g text;req uuid;a jsonb;again jsonb;args jsonb;ri bigint;ln integer:=600;before_balance numeric;expected numeric;
begin
 insert into auth.users(id,email,raw_user_meta_data) values(u,u||'@invalid.test','{}'),(v,v||'@invalid.test','{}');
 insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,1000,'test','lottery-history-test:'||u);
 ri:=floor(extract(epoch from clock_timestamp())/ln);
 if (ri+1)*ln-extract(epoch from clock_timestamp())<=6 then ln:=180;ri:=floor(extract(epoch from clock_timestamp())/ln);end if;
 foreach g in array array['k3','5d','trx-wingo'] loop
  req:=gen_random_uuid();args:=jsonb_build_object('lane',ln,'round',ri,'amount',6,'unit_amount',2,'quantity',3,'request_id',req,'selections',case g when 'k3' then '["Small","Big"]'::jsonb when '5d' then '["A:Small","A:Big"]'::jsonb else '["Red","Green"]'::jsonb end);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);execute 'set local role authenticated';
  a:=public.colorwin_lottery_batch(g,args);again:=public.colorwin_lottery_batch(g,args);
  if jsonb_array_length(a->'bets')<>2 or a->>'balance'<>again->>'balance' then raise exception 'History missing or duplicate debit for %',g;end if;
  if exists(select 1 from jsonb_array_elements(a->'bets') b where b->>'batch_request_id'<>req::text or (b->>'quantity')::integer<>3 or (b->>'unit_amount')::numeric<>2 or (b->>'quantity_known')::boolean is not true) then raise exception 'Metadata mismatch';end if;
  begin perform public.colorwin_lottery_batch(g,args||'{"quantity":2}'::jsonb);raise exception 'Invalid quantity accepted';exception when raise_exception then if sqlerrm<>'Invalid bet quantity' then raise;end if;end;
  execute 'reset role';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated')::text,true);execute 'set local role authenticated';
  again:=public.colorwin_lottery(g,'load',jsonb_build_object('lane',ln));if jsonb_array_length(again->'bets')<>0 then raise exception 'Foreign history exposed';end if;
  execute 'reset role';
 end loop;
 select sum(amount) into before_balance from public.account_wallet_ledger where user_id=u;
 if before_balance<>964 then raise exception 'Incorrect batch debit';end if;
 update colorwin_private.lottery_bets set round_index=ri-2 where user_id=u;
 perform colorwin_private.lottery_settle(u);perform colorwin_private.lottery_settle(u);
 if exists(select 1 from colorwin_private.lottery_bets where user_id=u and status='pending') then raise exception 'Settlement missing';end if;
 select sum(payout) into expected from colorwin_private.lottery_bets where user_id=u;
 if (select sum(amount) from public.account_wallet_ledger where user_id=u)<>before_balance+expected then raise exception 'Settlement credited incorrectly';end if;
 if exists(select 1 from colorwin_private.lottery_bets where user_id=u and (batch_request_id is null or quantity<>3)) then raise exception 'Settlement lost history metadata';end if;
end $$;
rollback;
