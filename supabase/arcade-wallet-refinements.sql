create or replace function colorwin_private.arcade_action(p_game text,p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=colorwin_private.assert_active();f colorwin_private.arcade_flights;b colorwin_private.arcade_bets;amount numeric;target numeric;auto_target numeric;bet_slot integer;req uuid;bal numeric;mx numeric;moment timestamptz:=clock_timestamp();phase text;result_data jsonb;begin
if p_game not in ('aviator','limbo') then raise exception 'Invalid game';end if;
perform pg_advisory_xact_lock(hashtextextended(u::text,94));moment:=clock_timestamp();
if p_game='limbo' then
if p_action='bet' then
req:=(p_data->>'request_id')::uuid;if req is null then raise exception 'Missing request ID';end if;
select * into b from colorwin_private.arcade_bets where user_id=u and request_id=req;
if found and b.game<>'limbo' then raise exception 'Request belongs to another game';end if;
if not found then
amount:=(p_data->>'amount')::numeric;target:=(p_data->>'target')::numeric;
if amount is null or amount not between 1 and 10000 or amount<>round(amount,2) or target is null or target not between 1.01 and 10000 or target<>round(target,2) then raise exception 'Invalid amount or target';end if;
select coalesce(sum(l.amount),0) into bal from public.account_wallet_ledger l where user_id=u;if bal<amount then raise exception 'Insufficient wallet balance';end if;
mx:=least(10000,greatest(1,trunc(.99/colorwin_private.arcade_random(),2)));
insert into colorwin_private.arcade_bets(user_id,game,request_id,amount,target,status,result,payout) values(u,'limbo',req,amount,target,case when mx>=target then 'cashed' else 'lost' end,mx,case when mx>=target then trunc(amount*target,2) else 0 end) returning * into b;
insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,-amount,'game_bet','limbo-bet:'||b.id);
if b.payout>0 then insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,b.payout,'game_win','limbo-win:'||b.id);end if;
insert into public.account_game_records(id,user_id,category,game_name,bet,winnings) values(b.id,u,'video','Limbo',amount,b.payout);
end if;
elsif p_action<>'load' then raise exception 'Unknown action';end if;
if b.id is not null then result_data:=jsonb_build_object('id',b.id,'status',b.status,'amount',b.amount,'target',b.target,'result',b.result,'payout',b.payout);end if;
else
select * into f from colorwin_private.arcade_flights where user_id=u order by created_at desc,id desc limit 1 for update;
if f.id is not null then
for b in select * from colorwin_private.arcade_bets where flight_id=f.id and status='active' for update loop
if b.auto_target is not null and b.auto_target<=f.crash_multiplier and moment>=f.starts_at+ln(b.auto_target::double precision)/.18*interval '1 second' then
b.status:='cashed';b.result:=b.auto_target;b.payout:=trunc(b.amount*b.auto_target,2);
elsif moment>=f.crash_at then b.status:='lost';b.result:=f.crash_multiplier;end if;
if b.status<>'active' then
update colorwin_private.arcade_bets set status=b.status,result=b.result,payout=b.payout where id=b.id;
if b.payout>0 then insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,b.payout,'game_win','aviator-win:'||b.id);end if;
update public.account_game_records set winnings=b.payout where id=b.id;
end if;end loop;end if;
if p_action='load' and (f.id is null or moment>=f.crash_at+interval '3 seconds') then
mx:=round(least(50,greatest(1.01,1-ln(1-colorwin_private.arcade_random())*1.6)),2);
insert into colorwin_private.arcade_flights(user_id,starts_at,crash_at,crash_multiplier) values(u,moment+interval '10 seconds',moment+interval '10 seconds'+ln(mx::double precision)/.18*interval '1 second',mx) returning * into f;
end if;
if f.id is null then raise exception 'Load a round first';end if;
phase:=case when moment<f.starts_at then 'waiting' when moment<f.crash_at then 'flying' else 'crashed' end;
if p_action='bet' then
req:=(p_data->>'request_id')::uuid;if req is null then raise exception 'Missing request ID';end if;
select * into b from colorwin_private.arcade_bets where user_id=u and request_id=req;
if found and b.game<>'aviator' then raise exception 'Request belongs to another game';end if;
if not found then
if phase<>'waiting' or (p_data->>'flight_id')::uuid is distinct from f.id then raise exception 'Betting closed for this round';end if;
amount:=(p_data->>'amount')::numeric;bet_slot:=(p_data->>'slot')::integer;auto_target:=(p_data->>'auto_target')::numeric;
if amount is null or amount not between 1 and 10000 or amount<>round(amount,2) or bet_slot is null or bet_slot not in (0,1) or (auto_target is not null and (auto_target not between 1.01 and 50 or auto_target<>round(auto_target,2))) then raise exception 'Invalid bet or auto cash out';end if;
select coalesce(sum(l.amount),0) into bal from public.account_wallet_ledger l where user_id=u;if bal<amount then raise exception 'Insufficient wallet balance';end if;
if exists(select 1 from colorwin_private.arcade_bets where flight_id=f.id and arcade_bets.slot=bet_slot and status='active') then raise exception 'Bet already placed';end if;
insert into colorwin_private.arcade_bets(user_id,game,flight_id,slot,request_id,amount,auto_target,status) values(u,'aviator',f.id,bet_slot,req,amount,auto_target,'active') returning * into b;
insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,-amount,'game_bet','aviator-bet:'||b.id);
insert into public.account_game_records(id,user_id,category,game_name,bet,winnings) values(b.id,u,'video','Aviator',amount,0);end if;
elsif p_action in ('cash','cancel') then
select * into b from colorwin_private.arcade_bets where id=(p_data->>'id')::uuid and user_id=u and game='aviator' for update;
if not found then raise exception 'Bet not found';end if;
if b.status='active' then
if b.flight_id<>f.id then raise exception 'Round is no longer active';end if;
if p_action='cancel' then
if phase<>'waiting' then raise exception 'Cancellation closed';end if;
update colorwin_private.arcade_bets set status='cancelled' where id=b.id;
insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,b.amount,'game_refund','aviator-refund:'||b.id);
update public.account_game_records set bet=0 where id=b.id;
else
if phase<>'flying' then raise exception 'Cash out unavailable';end if;
mx:=trunc(exp(greatest(0,extract(epoch from moment-f.starts_at))*.18),2);
b.payout:=trunc(b.amount*mx,2);
update colorwin_private.arcade_bets set status='cashed',result=mx,payout=b.payout where id=b.id;
insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,b.payout,'game_win','aviator-win:'||b.id);
update public.account_game_records set winnings=b.payout where id=b.id;
end if;end if;
elsif p_action<>'load' then raise exception 'Unknown action';end if;
result_data:=jsonb_build_object('id',f.id,'phase',phase,'starts_at',f.starts_at,'now',moment,'multiplier',case when phase='flying' then trunc(exp(extract(epoch from moment-f.starts_at)*.18),2) when phase='crashed' then f.crash_multiplier else 1 end,'bets',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'slot',x.slot,'amount',x.amount,'status',x.status,'auto_target',x.auto_target,'payout',x.payout,'result',x.result)) from colorwin_private.arcade_bets x where flight_id=f.id),'[]'::jsonb));
end if;
select coalesce(sum(l.amount),0) into bal from public.account_wallet_ledger l where user_id=u;
return jsonb_build_object('balance',bal,'round',result_data,'history',coalesce((select jsonb_agg(to_jsonb(x)) from(select h.id,h.amount,h.target,h.result,h.payout,h.status from colorwin_private.arcade_bets h where h.user_id=u and h.game=p_game and h.status in ('lost','cashed') order by h.created_at desc,h.id desc limit 20)x),'[]'::jsonb));
end $$;

CREATE OR REPLACE FUNCTION colorwin_private.withdrawal_need(p_user uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare need numeric:=0;e record;
begin
 for e in
 select delta from (
  select created_at,id,0 kind,amount delta from public.account_wallet_ledger
  where user_id=p_user and amount>0 and source not in ('withdrawal_refund','tournament_refund','game_refund')
  union all
  -- Successful paid registrations count once. Cancelled/refunded entries do not count.
  select l.created_at,l.id,1 kind,l.amount delta from public.account_wallet_ledger l
  where l.user_id=p_user and l.source='tournament_entry' and l.amount<0
  and not exists (
   select 1 from public.account_wallet_ledger r where r.user_id=p_user
   and r.source='tournament_refund'
   and r.reference=replace(l.reference,'tournament-entry:','tournament-refund:')
  )
  union all
  select created_at,id,1 kind,-bet delta from public.account_game_records where user_id=p_user and bet>0
 ) events order by created_at,kind,id
 loop need:=greatest(0,need+e.delta);end loop;
 return need;
end $function$

