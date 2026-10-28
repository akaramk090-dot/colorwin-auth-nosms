begin;
do $$declare u uuid:=gen_random_uuid();ln integer;ri bigint;data jsonb;stamp numeric;a integer[];again integer[];bet_id uuid;begin
 insert into auth.users(id,email,raw_user_meta_data) values(u,u||'@invalid.test','{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,100,'test','random-trx-test:'||u);
 foreach ln in array array[60,180,300,600] loop
  data:=public.colorwin_lottery('trx-wingo','load',jsonb_build_object('lane',ln));stamp:=(data->>'server_ms')::numeric/1000;ri:=floor(stamp/ln);
  if (data->>'round')::bigint<>ri or abs((data->>'remaining')::numeric-((ri+1)*ln-stamp))>0.003 or data->>'result_source'<>'server-random' then raise exception 'Invalid random-clock response';end if;
  a:=colorwin_private.lottery_result('trx-wingo',ln,ri-100000);again:=colorwin_private.lottery_result('trx-wingo',ln,ri-100000);
  if array_length(a,1)<>1 or a[1] not between 0 and 9 or a<>again then raise exception 'Invalid or unstable random draw';end if;
  begin perform colorwin_private.lottery_result('trx-wingo',ln,ri+1);raise exception 'Future result accepted';exception when raise_exception then if sqlerrm<>'Result not available' then raise;end if;end;
 end loop;
 select x into ln from unnest(array[600,300,180,60])x where x-mod(extract(epoch from clock_timestamp()),x)>15 limit 1;
 ri:=floor(extract(epoch from clock_timestamp())/ln);
 data:=public.colorwin_lottery('trx-wingo','bet',jsonb_build_object('lane',ln,'round',ri,'selection','Big','amount',1,'request_id',gen_random_uuid()));bet_id:=(data->>'accepted_id')::uuid;
 a:=colorwin_private.lottery_result('trx-wingo',ln,ri-1000);
 update colorwin_private.lottery_bets set round_index=ri-1000,selection=a[1]::text,odds=9.8 where id=bet_id;
 perform colorwin_private.lottery_settle(u);perform colorwin_private.lottery_settle(u);
 if (select payout from colorwin_private.lottery_bets where id=bet_id)<>9.8 or (select count(*) from public.account_wallet_ledger where reference='lottery-win:'||bet_id)<>1 then raise exception 'Settlement not exactly once';end if;
end $$;
rollback;
