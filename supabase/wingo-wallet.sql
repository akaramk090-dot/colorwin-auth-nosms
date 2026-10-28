create table colorwin_private.wingo_results(lane integer not null check(lane in(30,60,180,300)),round_index bigint not null,number integer not null check(number between 0 and 9),primary key(lane,round_index));
create table colorwin_private.wingo_bets(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),request_id uuid not null,lane integer not null check(lane in(30,60,180,300)),round_index bigint not null,selection text not null,stake numeric(14,2) not null check(stake between 1 and 10000),status text not null default 'pending' check(status in('pending','won','lost')),payout numeric(18,2) not null default 0,result integer,created_at timestamptz not null default clock_timestamp(),unique(user_id,request_id));
create index wingo_owner_recent on colorwin_private.wingo_bets(user_id,created_at desc);
create index wingo_pending on colorwin_private.wingo_bets(user_id,lane,round_index) where status='pending';
alter table colorwin_private.wingo_results enable row level security;
alter table colorwin_private.wingo_bets enable row level security;
revoke all on colorwin_private.wingo_results,colorwin_private.wingo_bets from public,anon,authenticated;
create function colorwin_private.wingo_result(p_lane integer,p_round bigint) returns integer language plpgsql set search_path='' as $$
declare n integer;begin
 if p_lane not in(30,60,180,300) or p_round>=floor(extract(epoch from clock_timestamp())/p_lane) then raise exception 'Result not available';end if;
 perform pg_advisory_xact_lock(hashtextextended('wingo:'||p_lane||':'||p_round,95));
 select r.number into n from colorwin_private.wingo_results r where r.lane=p_lane and r.round_index=p_round;
 if not found then loop n:=get_byte(extensions.gen_random_bytes(1),0);exit when n<250;end loop;n:=n%10;insert into colorwin_private.wingo_results values(p_lane,p_round,n);end if;return n;
end $$;
create function colorwin_private.wingo_payout(s text,n integer,b numeric) returns numeric language sql immutable set search_path='' as $$
 select trunc(b*case when s=n::text then 9 when s='Big' and n>=5 or s='Small' and n<5 then 1.95 when s='Violet' and n in(0,5) then 4.5 when s='Green' and n%2=1 or s='Red' and n%2=0 then 2 else 0 end,2);
$$;
create function colorwin_private.wingo_settle(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare b colorwin_private.wingo_bets;n integer;p numeric;begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,94));
 for b in select * from colorwin_private.wingo_bets t where t.user_id=p_user and t.status='pending' and (t.round_index+1)*t.lane<=extract(epoch from clock_timestamp()) order by t.lane,t.round_index,t.id for update loop
 n:=colorwin_private.wingo_result(b.lane,b.round_index);p:=colorwin_private.wingo_payout(b.selection,n,b.stake);
 update colorwin_private.wingo_bets set status=case when p>0 then 'won' else 'lost' end,result=n,payout=p where id=b.id;
 if p>0 then insert into public.account_wallet_ledger(user_id,amount,source,reference) values(p_user,p,'game_win','wingo-win:'||b.id);end if;
 update public.account_game_records set winnings=p where id=b.id;
 end loop;
end $$;
create function colorwin_private.wingo_action(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=colorwin_private.assert_active();ln integer:=(coalesce(p_data->>'lane','30'))::integer;ri bigint;stamp numeric;amt numeric;sel text;req uuid;bal numeric;hist jsonb;mine jsonb;b colorwin_private.wingo_bets;begin
 if ln is null or ln not in(30,60,180,300) then raise exception 'Invalid Wingo period';end if;
 perform colorwin_private.wingo_settle(u);
 if p_action='bet' then
 req:=(p_data->>'request_id')::uuid;if req is null then raise exception 'Missing request ID';end if;
 select * into b from colorwin_private.wingo_bets t where t.user_id=u and t.request_id=req;
 if not found then
 amt:=(p_data->>'amount')::numeric;sel:=p_data->>'selection';
 if amt is null or not(amt between 1 and 10000) or amt<>round(amt,2) or sel is null or sel not in('0','1','2','3','4','5','6','7','8','9','Big','Small','Green','Red','Violet') then raise exception 'Invalid bet';end if;
 stamp:=extract(epoch from clock_timestamp());ri:=floor(stamp/ln);
 if (p_data->>'round')::bigint is distinct from ri or (ri+1)*ln-stamp<=5 then raise exception 'Betting closed. Please use the next round';end if;
 select coalesce(sum(l.amount),0) into bal from public.account_wallet_ledger l where l.user_id=u;if bal<amt then raise exception 'Insufficient wallet balance';end if;
 insert into colorwin_private.wingo_bets(user_id,request_id,lane,round_index,selection,stake) values(u,req,ln,ri,sel,amt) returning * into b;
 insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,-amt,'game_bet','wingo-bet:'||b.id);
 insert into public.account_game_records(id,user_id,category,game_name,bet,winnings) values(b.id,u,'lottery','Win Go',amt,0);
 elsif b.lane<>ln or b.selection is distinct from p_data->>'selection' or b.stake is distinct from (p_data->>'amount')::numeric then raise exception 'Request ID already used';end if;
 elsif p_action<>'load' then raise exception 'Invalid Wingo action';end if;
 stamp:=extract(epoch from clock_timestamp());ri:=floor(stamp/ln);
 select jsonb_agg(jsonb_build_object('index',x,'n',colorwin_private.wingo_result(ln,x)) order by x desc) into hist from generate_series(ri-100,ri-1)x;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at),'[]') into mine from (select id,lane,round_index,selection,stake,status,payout,result,created_at from colorwin_private.wingo_bets where user_id=u order by created_at desc limit 200)t;
 select coalesce(sum(l.amount),0) into bal from public.account_wallet_ledger l where l.user_id=u;
 return jsonb_build_object('balance',bal,'server_ms',floor(extract(epoch from clock_timestamp())*1000),'lane',ln,'history',hist,'bets',mine,'accepted_id',b.id);
end $$;
revoke all on function colorwin_private.wingo_result(integer,bigint),colorwin_private.wingo_payout(text,integer,numeric),colorwin_private.wingo_settle(uuid),colorwin_private.wingo_action(text,jsonb) from public,anon,authenticated;
grant execute on function colorwin_private.wingo_action(text,jsonb) to authenticated;
create function public.colorwin_wingo(p_action text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.wingo_action(p_action,p_data);$$;
revoke all on function public.colorwin_wingo(text,jsonb) from public,anon;
grant execute on function public.colorwin_wingo(text,jsonb) to authenticated;
create function colorwin_private.wingo_settle_due() returns void language plpgsql security definer set search_path='' as $$declare u uuid;begin for u in select distinct user_id from colorwin_private.wingo_bets where status='pending' and (round_index+1)*lane<=extract(epoch from clock_timestamp()) limit 300 loop perform colorwin_private.wingo_settle(u);end loop;end $$;
revoke all on function colorwin_private.wingo_settle_due() from public,anon,authenticated;
select cron.schedule('colorwin-wingo-settle','* * * * *','select colorwin_private.wingo_settle_due();');
