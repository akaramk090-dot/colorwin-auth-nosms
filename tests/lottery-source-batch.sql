begin;
do $$
declare u uuid:=gen_random_uuid();req uuid:=gen_random_uuid();ln integer;ri bigint;r jsonb;d jsonb;before_count integer;
begin
 insert into auth.users(id,email,raw_user_meta_data) values(u,u||'@invalid.test','{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,100,'test','source-batch:'||u);
 select x into ln from unnest(array[600,300,180,60])x where x-mod(extract(epoch from clock_timestamp()),x)>15 limit 1;ri:=floor(extract(epoch from clock_timestamp())/ln);
 d:=jsonb_build_object('request_id',req,'lane',ln,'round',ri,'amount',2,'selections',jsonb_build_array('sum:3','sum:4'));
 r:=public.colorwin_lottery_batch('k3',d);if (r->>'balance')::numeric<>96 then raise exception 'Batch debit failed';end if;
 r:=public.colorwin_lottery_batch('k3',d);if (r->>'balance')::numeric<>96 then raise exception 'Batch double debit';end if;
 select count(*) into before_count from colorwin_private.lottery_bets where user_id=u;
 begin perform public.colorwin_lottery_batch('k3',d||jsonb_build_object('request_id',gen_random_uuid(),'selections',jsonb_build_array('sum:5','bogus')));raise exception 'Invalid batch accepted';exception when raise_exception then if sqlerrm<>'Invalid lottery selection' then raise;end if;end;
 if (select count(*) from colorwin_private.lottery_bets where user_id=u)<>before_count or (select sum(amount) from public.account_wallet_ledger where user_id=u)<>96 then raise exception 'Partial batch was charged';end if;
 begin perform public.colorwin_lottery_batch('k3',d||'{"amount":3}');raise exception 'Changed replay accepted';exception when raise_exception then if sqlerrm<>'Request ID already used' then raise;end if;end;
 begin perform public.colorwin_lottery_batch('5d',d||jsonb_build_object('request_id',gen_random_uuid(),'selections',jsonb_build_array('A:0','B:0'),'amount',80));raise exception 'Insufficient batch accepted';exception when raise_exception then if sqlerrm<>'Insufficient wallet balance' then raise;end if;end;
 if (select sum(amount) from public.account_wallet_ledger where user_id=u)<>96 then raise exception 'Insufficient batch partially charged';end if;
 execute 'set local role authenticated';r:=public.colorwin_lottery_batch('k3',d);if (r->>'balance')::numeric<>96 then raise exception 'Authenticated replay failed';end if;
 begin perform * from colorwin_private.lottery_requests;raise exception 'Request records exposed';exception when insufficient_privilege then null;end;execute 'reset role';
end $$;
rollback;
