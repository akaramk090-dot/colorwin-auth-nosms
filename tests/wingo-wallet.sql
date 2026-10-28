begin;
do $$ declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();r jsonb;req uuid:=gen_random_uuid();ln integer;ix bigint;n integer;rid uuid;begin
insert into auth.users(id,email,raw_user_meta_data) values(u,u||'@invalid.test','{}'),(v,v||'@invalid.test','{}');
perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
select x into ln from unnest(array[300,180,60,30])x where x-mod(extract(epoch from clock_timestamp()),x)>10 limit 1;
ix:=floor(extract(epoch from clock_timestamp())/ln);
begin perform public.colorwin_wingo('bet',jsonb_build_object('lane',ln,'round',ix,'selection','Big','amount',50,'request_id',req));raise exception 'Missing balance accepted';exception when raise_exception then if sqlerrm<>'Insufficient wallet balance' then raise;end if;end;
insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,100,'test','wingo-test:'||u);
r:=public.colorwin_wingo('bet',jsonb_build_object('lane',ln,'round',ix,'selection','Big','amount',50,'request_id',req));if (r->>'balance')::numeric<>50 then raise exception 'Debit failed';end if;rid:=(r->>'accepted_id')::uuid;
r:=public.colorwin_wingo('bet',jsonb_build_object('lane',ln,'round',ix,'selection','Big','amount',50,'request_id',req));if (r->>'balance')::numeric<>50 then raise exception 'Duplicate debit';end if;
n:=colorwin_private.wingo_result(ln,ix-1);update colorwin_private.wingo_bets set round_index=ix-1,selection=n::text where id=rid;
perform colorwin_private.wingo_settle(u);perform colorwin_private.wingo_settle(u);
if (select sum(amount) from public.account_wallet_ledger where user_id=u)<>500 then raise exception 'Win credit not exactly once';end if;
if (select winnings from public.account_game_records where id=rid)<>450 then raise exception 'History failed';end if;
begin perform colorwin_private.wingo_result(ln,ix);raise exception 'Future result revealed';exception when raise_exception then if sqlerrm<>'Result not available' then raise;end if;end;
execute 'set local role authenticated';begin perform * from colorwin_private.wingo_bets;raise exception 'Private table readable';exception when insufficient_privilege then null;end;execute 'reset role';
perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated')::text,true);r:=public.colorwin_wingo('load',jsonb_build_object('lane',ln));if jsonb_array_length(r->'bets')<>0 then raise exception 'Other bets leaked';end if;
end $$;
rollback;
