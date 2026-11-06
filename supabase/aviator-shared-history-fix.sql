create or replace function colorwin_private.aviator_action(p_action text,p_data jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare u uuid:=colorwin_private.assert_active();f colorwin_private.arcade_flights;b colorwin_private.arcade_bets;
 moment timestamptz:=clock_timestamp(); phase text; amount numeric; auto_target numeric; bet_slot integer; req uuid;bal numeric;mx numeric; round_data jsonb;begin
 if p_action not in ('load','bet','cash','cancel') then raise exception 'Unknown action';end if;
 -- Lock ordering: shared timeline creation first, then this player's wallet lock.
 f:=colorwin_private.aviator_current(moment);
 perform pg_advisory_xact_lock(hashtextextended(u::text,94));
 moment:=clock_timestamp();
 perform colorwin_private.aviator_settle_user(u,moment);
 phase:=case when moment<f.starts_at then 'waiting' when moment<f.crash_at then 'flying' else 'crashed' end;
 if p_action='bet' then
  req:=(p_data->>'request_id')::uuid;if req is null then raise exception 'Missing request ID';end if;
  select * into b from colorwin_private.arcade_bets where user_id=u and request_id=req;
  if found and b.game<>'aviator' then raise exception 'Request belongs to another game';end if;
  if not found then
   if phase<>'waiting' or (p_data->>'flight_id')::uuid is distinct from f.id then raise exception 'Betting closed for this round';end if;
   amount:=(p_data->>'amount')::numeric;bet_slot:=(p_data->>'slot')::integer;auto_target:=(p_data->>'auto_target')::numeric;
   if amount is null or amount not between 1 and 10000 or amount<>round(amount,2) or bet_slot is null or bet_slot not in(0,1)
    or(auto_target is not null and(auto_target not between 1.01 and 50 or auto_target<>round(auto_target,2))) then raise exception 'Invalid bet or auto cash out';end if;
   select coalesce(sum(l.amount),0) into bal from public.account_wallet_ledger l where user_id=u;
   if bal<amount then raise exception 'Insufficient wallet balance';end if;
   if exists(select 1 from colorwin_private.arcade_bets where flight_id=f.id and user_id=u and slot=bet_slot and status='active') then raise exception 'Bet already placed';end if;
   insert into colorwin_private.arcade_bets(user_id,game,flight_id,slot,request_id,amount,auto_target,status)
   values(u,'aviator',f.id,bet_slot,req,amount,auto_target,'active') returning * into b;
   insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,-amount,'game_bet','aviator-bet:'||b.id);
   insert into public.account_game_records(id,user_id,category,game_name,bet,winnings) values(b.id,u,'video','Aviator',amount,0);
  end if;
 elsif p_action in('cash','cancel') then
  select * into b from colorwin_private.arcade_bets where id=(p_data->>'id')::uuid and user_id=u and game='aviator' for update;
  if not found then raise exception 'Bet not found';end if;
  if b.status='active' then
   if b.flight_id<>f.id then raise exception 'Round is no longer active';end if;
   if p_action='cancel' then
    if phase<>'waiting' then raise exception 'Cancellation closed';end if;
    update colorwin_private.arcade_bets set status='cancelled' where id=b.id;
    insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,b.amount,'game_refund','aviator-refund:'||b.id);
    update public.account_game_records set bet=0 where id=b.id and user_id=u;
   else
    if phase<>'flying' then raise exception 'Cash out unavailable';end if;
    mx:=trunc(exp(greatest(0,extract(epoch from moment-f.starts_at))*.18),2);b.payout:=trunc(b.amount*mx,2);
    update colorwin_private.arcade_bets set status='cashed',result=mx,payout=b.payout where id=b.id;
    insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,b.payout,'game_win','aviator-win:'||b.id);
    update public.account_game_records set winnings=b.payout where id=b.id and user_id=u;
   end if;
  end if;
 end if;
 round_data:=jsonb_build_object('id',f.id,'shared',true,'phase',phase,'starts_at',f.starts_at,'now',moment,
  'multiplier',case when phase='flying' then trunc(exp(extract(epoch from moment-f.starts_at)*.18),2) when phase='crashed' then f.crash_multiplier else 1 end,
  'bets',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'slot',x.slot,'amount',x.amount,'status',x.status,'auto_target',x.auto_target,'payout',x.payout,'result',x.result))
   from colorwin_private.arcade_bets x where x.flight_id=f.id and x.user_id=u),'[]'::jsonb));
 select coalesce(sum(l.amount),0) into bal from public.account_wallet_ledger l where user_id=u;
 return jsonb_build_object('balance',bal,'round',round_data,
  'round_history',coalesce((select jsonb_agg(to_jsonb(x)) from(select id,crash_multiplier as result,starts_at from colorwin_private.arcade_flights
   where is_shared and crash_at<=moment order by starts_at desc limit 30)x),'[]'::jsonb),
  'history',coalesce((select jsonb_agg(to_jsonb(x)) from(select h.id,h.flight_id,h.amount,h.target,h.result,h.payout,h.status from colorwin_private.arcade_bets h
   where h.user_id=u and h.game='aviator' and h.status in('lost','cashed') order by h.created_at desc,h.id desc limit 20)x),'[]'::jsonb));
end $$;

