create or replace function colorwin_private.lottery_action(g text,act text,d jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=colorwin_private.assert_active();ln integer:=coalesce((d->>'lane')::integer,60);ri bigint;stamp numeric;amt numeric;sel text;req uuid;bal numeric;hist jsonb;mine jsonb;b colorwin_private.lottery_bets;h colorwin_private.lottery_chain_head;remaining numeric;begin
 if g is null or g not in('k3','5d','trx-wingo') or ln is null or ln not in(60,180,300,600) then raise exception 'Invalid lottery game';end if;
 perform colorwin_private.lottery_settle(u);
 stamp:=extract(epoch from clock_timestamp());
 if g='trx-wingo' then
  select * into h from colorwin_private.lottery_chain_head where id;
  if h.height is null or h.checked_at<clock_timestamp()-interval '8 seconds' then raise exception 'TRX network is updating. Please try again';end if;
  ri:=h.height/(ln/3);remaining:=greatest(0,((ri+1)*(ln/3)-h.height)*3-(stamp-h.block_ms/1000.0));
 else ri:=floor(stamp/ln);remaining:=(ri+1)*ln-stamp;end if;
 if act='bet' then
  req:=(d->>'request_id')::uuid;if req is null then raise exception 'Missing request ID';end if;
  select * into b from colorwin_private.lottery_bets t where t.user_id=u and t.request_id=req;
  if found then
   if b.game<>g or b.lane<>ln or b.round_index is distinct from (d->>'round')::bigint or b.selection is distinct from d->>'selection' or b.stake is distinct from (d->>'amount')::numeric then raise exception 'Request ID already used';end if;
  else
   if exists(select 1 from colorwin_private.game_controls where game_id=g and not enabled) then raise exception 'This game is temporarily unavailable';end if;
   amt:=(d->>'amount')::numeric;sel:=d->>'selection';
   if amt is null or not(amt between 1 and 10000) or amt<>round(amt,2) or sel is null then raise exception 'Invalid bet';end if;
   if (d->>'round')::bigint is distinct from ri or remaining<=6 then raise exception 'Betting closed. Please use the next round';end if;
   select coalesce(sum(l.amount),0) into bal from public.account_wallet_ledger l where l.user_id=u;if bal<amt then raise exception 'Insufficient wallet balance';end if;
   insert into colorwin_private.lottery_bets(user_id,request_id,game,lane,round_index,selection,stake,odds) values(u,req,g,ln,ri,sel,amt,colorwin_private.lottery_odds(g,sel)) returning * into b;
   insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,-amt,'game_bet','lottery-bet:'||b.id);
   insert into public.account_game_records(id,user_id,category,game_name,bet,winnings) values(b.id,u,'lottery',case g when 'k3' then 'K3' when '5d' then '5D' else 'TRX Win Go' end,amt,0);
  end if;
 elsif act<>'load' or act is null then raise exception 'Invalid lottery action';end if;
 if g<>'trx-wingo' then perform colorwin_private.lottery_result(g,ln,x) from generate_series(ri-20,ri-1)x;end if;
 select coalesce(jsonb_agg(jsonb_build_object('index',r.round_index,'numbers',r.numbers,'block_id',r.block_id,'block_number',r.block_number) order by r.round_index desc),'[]') into hist from
 (select * from colorwin_private.lottery_results where game=g and lane=ln and round_index<ri order by round_index desc limit 50)r;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]') into mine from(select id,game,lane,round_index,selection,stake,odds,status,payout,result,created_at from colorwin_private.lottery_bets where user_id=u and game=g order by created_at desc limit 100)t;
 select coalesce(sum(l.amount),0) into bal from public.account_wallet_ledger l where l.user_id=u;
 return jsonb_build_object('balance',bal,'server_ms',floor(stamp*1000),'lane',ln,'round',ri,'remaining',remaining,'history',hist,'bets',mine,'accepted_id',b.id,'chain_height',h.height);
end $$;
