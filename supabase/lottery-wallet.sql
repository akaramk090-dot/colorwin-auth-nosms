-- K3 and 5D results are generated on the server after a round closes.
-- TRX results use a finalized block ID supplied only by the authenticated Edge worker.
create table colorwin_private.lottery_results(
 game text not null check(game in('k3','5d','trx-wingo')),lane integer not null check(lane in(60,180,300,600)),
 round_index bigint not null,numbers integer[] not null,block_id text,block_number bigint,block_ms bigint,primary key(game,lane,round_index)
);
create table colorwin_private.lottery_bets(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),request_id uuid not null,
 game text not null check(game in('k3','5d','trx-wingo')),lane integer not null check(lane in(60,180,300,600)),round_index bigint not null,
 selection text not null,stake numeric(14,2) not null check(stake between 1 and 10000),odds numeric not null check(odds>0),
 status text not null default 'pending' check(status in('pending','won','lost')),payout numeric(18,2) not null default 0,result integer[],
 created_at timestamptz not null default clock_timestamp(),unique(user_id,request_id)
);
create index lottery_owner_recent on colorwin_private.lottery_bets(user_id,created_at desc);
create index lottery_due on colorwin_private.lottery_bets(game,lane,round_index,user_id) where status='pending';
create table colorwin_private.lottery_chain_head(id boolean primary key default true check(id),height bigint not null,block_id text not null,block_ms bigint not null,checked_at timestamptz not null default clock_timestamp());
alter table colorwin_private.lottery_results enable row level security;
alter table colorwin_private.lottery_bets enable row level security;
alter table colorwin_private.lottery_chain_head enable row level security;
revoke all on colorwin_private.lottery_results,colorwin_private.lottery_bets,colorwin_private.lottery_chain_head from public,anon,authenticated;
create function colorwin_private.lottery_odds(g text,s text) returns numeric language plpgsql immutable set search_path='' as $$
declare n integer;counts integer[]:=array[1,3,6,10,15,21,25,27,27,25,21,15,10,6,3,1];begin
 if g='k3' then
  if s in('Big','Small','Odd','Even') then return 1.96;end if;
  if s ~ '^sum:([3-9]|1[0-8])$' then n:=split_part(s,':',2)::integer;return trunc(211.68/counts[n-2],2);end if;
  if s ~ '^triple:[1-6]$' then return 207.36;end if;
  if s='Any triple' then return 34.56;end if;
  if s ~ '^pair:[1-6]$' then return 12.96;end if;
  if s ~ '^pair:[1-6]:[1-6]$' and split_part(s,':',2)<>split_part(s,':',3) then return 69.12;end if;
  if s ~ '^different:[1-6],[1-6],[1-6]$' and substring(s from 11 for 1)<substring(s from 13 for 1) and substring(s from 13 for 1)<substring(s from 15 for 1) then return 34.56;end if;
  if s ~ '^two:[1-6],[1-6]$' and substring(s from 5 for 1)<substring(s from 7 for 1) then return 6.91;end if;
  if s='Sequence' then return 8.64;end if;
 elsif g='5d' then
  if s ~ '^[A-E]:[0-9]$' then return 9.8;end if;
  if s ~ '^[A-E]:(Big|Small|Odd|Even)$' then return 1.96;end if;
  if s in('Sum:Big','Sum:Small','Sum:Odd','Sum:Even') then return 1.96;end if;
 elsif g='trx-wingo' then
  if s ~ '^[0-9]$' then return 9.8;end if;
  if s in('Green','Red','Big','Small') then return 1.96;end if;
  if s='Violet' then return 4.41;end if;
 end if;
 raise exception 'Invalid lottery selection';
end $$;
create function colorwin_private.lottery_payout(g text,s text,a integer[],stake numeric,odds numeric) returns numeric language plpgsql immutable set search_path='' as $$
declare n integer;total integer;hit boolean:=false;kind text;sorted integer[];begin
 select sum(x) into total from unnest(a)x;
 if g='k3' then
  hit:=case when s='Big' then total>=11 when s='Small' then total<=10 when s='Odd' then total%2=1 when s='Even' then total%2=0
   when s like 'sum:%' then total=split_part(s,':',2)::integer
   when s='Any triple' then a[1]=a[2] and a[2]=a[3]
   when s like 'triple:%' then a[1]=split_part(s,':',2)::integer and a[1]=a[2] and a[2]=a[3] else false end;
  if s ~ '^pair:[1-6]$' then hit:=(select count(*) from unnest(a)x where x=split_part(s,':',2)::integer)>=2;
  elsif s ~ '^pair:[1-6]:[1-6]$' then hit:=(select count(*) from unnest(a)x where x=split_part(s,':',2)::integer)=2 and split_part(s,':',3)::integer=any(a);
  elsif s like 'different:%' then select array_agg(x order by x) into sorted from unnest(a)x;hit:=sorted=string_to_array(split_part(s,':',2),',')::integer[];
  elsif s like 'two:%' then hit:=substring(s from 5 for 1)::integer=any(a) and substring(s from 7 for 1)::integer=any(a);
  elsif s='Sequence' then select array_agg(x order by x) into sorted from unnest(a)x;hit:=sorted[2]=sorted[1]+1 and sorted[3]=sorted[2]+1;end if;
 elsif g='5d' then
  n:=case when s like 'Sum:%' then total else a[ascii(left(s,1))-64] end;kind:=split_part(s,':',2);
  hit:=case when kind='Big' then n>=case when s like 'Sum:%' then 23 else 5 end when kind='Small' then n<case when s like 'Sum:%' then 23 else 5 end
   when kind='Odd' then n%2=1 when kind='Even' then n%2=0 else kind=n::text end;
 elsif g='trx-wingo' then
  n:=a[1];hit:=case when s='Big' then n>=5 when s='Small' then n<5 when s='Green' then n%2=1 when s='Red' then n%2=0 when s='Violet' then n in(0,5) else s=n::text end;
  if hit and s in('Green','Red') and n in(0,5) then return trunc(stake*1.47,2);end if;
 end if;
 return case when hit then trunc(stake*odds,2) else 0 end;
end $$;
create function colorwin_private.lottery_result(g text,ln integer,ri bigint) returns integer[] language plpgsql set search_path='' as $$
declare a integer[];i integer;n integer;cap integer;begin
 if g not in('k3','5d','trx-wingo') or ln not in(60,180,300,600) then raise exception 'Invalid lottery game';end if;
 if g<>'trx-wingo' and ri>=floor(extract(epoch from clock_timestamp())/ln) then raise exception 'Result not available';end if;
 perform pg_advisory_xact_lock(hashtextextended(g||':'||ln||':'||ri,193));
 select numbers into a from colorwin_private.lottery_results where game=g and lane=ln and round_index=ri;
 if found or g='trx-wingo' then return a;end if;
 a:=array[]::integer[];cap:=case when g='k3' then 252 else 250 end;
 for i in 1..case when g='k3' then 3 else 5 end loop
  loop n:=get_byte(extensions.gen_random_bytes(1),0);exit when n<cap;end loop;
  a:=array_append(a,n%case when g='k3' then 6 else 10 end+case when g='k3' then 1 else 0 end);
 end loop;
 insert into colorwin_private.lottery_results(game,lane,round_index,numbers) values(g,ln,ri,a);return a;
end $$;
create function colorwin_private.lottery_settle(u uuid) returns void language plpgsql security definer set search_path='' as $$
declare b colorwin_private.lottery_bets;a integer[];p numeric;begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,94));
 for b in select * from colorwin_private.lottery_bets t where user_id=u and status='pending' and
 (case when game='trx-wingo' then exists(select 1 from colorwin_private.lottery_results r where r.game=t.game and r.lane=t.lane and r.round_index=t.round_index) else (round_index+1)*lane<=extract(epoch from clock_timestamp()) end)
 order by game,lane,round_index,id for update loop
 a:=colorwin_private.lottery_result(b.game,b.lane,b.round_index);if a is null then continue;end if;
 p:=colorwin_private.lottery_payout(b.game,b.selection,a,b.stake,b.odds);
 update colorwin_private.lottery_bets set status=case when p>0 then 'won' else 'lost' end,payout=p,result=a where id=b.id;
 if p>0 then insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,p,'game_win','lottery-win:'||b.id);end if;
 update public.account_game_records set winnings=p where id=b.id;
 end loop;
end $$;
create function colorwin_private.lottery_action(g text,act text,d jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 select coalesce(jsonb_agg(jsonb_build_object('index',r.round_index,'numbers',r.numbers,'block_id',r.block_id,'block_number',r.block_number,'block_ms',r.block_ms) order by r.round_index desc),'[]') into hist from
 (select * from colorwin_private.lottery_results where game=g and lane=ln and round_index<ri order by round_index desc limit 50)r;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]') into mine from(select id,game,lane,round_index,selection,stake,odds,status,payout,result,created_at from colorwin_private.lottery_bets where user_id=u and game=g order by created_at desc limit 100)t;
 select coalesce(sum(l.amount),0) into bal from public.account_wallet_ledger l where l.user_id=u;
 return jsonb_build_object('balance',bal,'server_ms',floor(stamp*1000),'lane',ln,'round',ri,'remaining',remaining,'history',hist,'bets',mine,'accepted_id',b.id,'chain_height',h.height);
end $$;
revoke all on function colorwin_private.lottery_odds(text,text),colorwin_private.lottery_payout(text,text,integer[],numeric,numeric),colorwin_private.lottery_result(text,integer,bigint),colorwin_private.lottery_settle(uuid),colorwin_private.lottery_action(text,text,jsonb) from public,anon,authenticated;
grant execute on function colorwin_private.lottery_action(text,text,jsonb) to authenticated;
create function public.colorwin_lottery(p_game text,p_action text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.lottery_action(p_game,p_action,p_data);$$;
revoke all on function public.colorwin_lottery(text,text,jsonb) from public,anon;grant execute on function public.colorwin_lottery(text,text,jsonb) to authenticated;
create function colorwin_private.lottery_chain_sync(head jsonb,results jsonb default '[]') returns jsonb language plpgsql security definer set search_path='' as $$
declare h bigint:=(head->>'height')::bigint;ms bigint:=(head->>'ms')::bigint;hash text:=head->>'hash';r jsonb;ln integer;ri bigint;bh bigint;bid text;n integer;targets jsonb;begin
 if h is null or h<=0 or ms is null or hash !~ '^[0-9a-f]{64}$' or left(hash,16)<>lpad(to_hex(h),16,'0') then raise exception 'Invalid TRX head';end if;
 insert into colorwin_private.lottery_chain_head values(true,h,hash,ms,clock_timestamp()) on conflict(id) do update set height=excluded.height,block_id=excluded.block_id,block_ms=excluded.block_ms,checked_at=excluded.checked_at where lottery_chain_head.height<=excluded.height;
 for r in select value from jsonb_array_elements(results) loop
  ln:=(r->>'lane')::integer;ri:=(r->>'round')::bigint;bh:=(r->>'height')::bigint;bid:=r->>'hash';
  if ln is null or ln not in(60,180,300,600) or ri is null or ri<0 or bh is distinct from (ri+1)*(ln/3)-1 or bh>=h or bid !~ '^[0-9a-f]{64}$' or left(bid,16)<>lpad(to_hex(bh),16,'0') then raise exception 'Invalid TRX result block';end if;
  n:=right(regexp_replace(bid,'[a-f]','','g'),1)::integer;
  insert into colorwin_private.lottery_results(game,lane,round_index,numbers,block_id,block_number,block_ms) values('trx-wingo',ln,ri,array[n],bid,bh,(r->>'ms')::bigint) on conflict do nothing;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('lane',t.lane,'round',t.ri,'height',(t.ri+1)*(t.lane/3)-1)),'[]') into targets from (
  select distinct q.lane,q.ri from (
   select lane,round_index ri from colorwin_private.lottery_bets where game='trx-wingo' and status='pending' and (round_index+1)*(lane/3)<h
   union select x,h/(x/3)-1 from unnest(array[60,180,300,600])x
  )q where q.ri>=0 and not exists(select 1 from colorwin_private.lottery_results rr where rr.game='trx-wingo' and rr.lane=q.lane and rr.round_index=q.ri) order by q.ri limit 24
 )t;
 return jsonb_build_object('targets',targets);
end $$;
revoke all on function colorwin_private.lottery_chain_sync(jsonb,jsonb) from public,anon,authenticated;
grant execute on function colorwin_private.lottery_chain_sync(jsonb,jsonb) to service_role;
create function public.colorwin_lottery_chain_sync(p_head jsonb,p_results jsonb default '[]') returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.lottery_chain_sync(p_head,p_results);$$;
revoke all on function public.colorwin_lottery_chain_sync(jsonb,jsonb) from public,anon,authenticated;grant execute on function public.colorwin_lottery_chain_sync(jsonb,jsonb) to service_role;
create function colorwin_private.lottery_settle_due() returns void language plpgsql security definer set search_path='' as $$declare u uuid;begin
 for u in select distinct user_id from colorwin_private.lottery_bets t where status='pending' and (case when game='trx-wingo' then exists(select 1 from colorwin_private.lottery_results r where r.game=t.game and r.lane=t.lane and r.round_index=t.round_index) else (round_index+1)*lane<=extract(epoch from clock_timestamp()) end) limit 300 loop perform colorwin_private.lottery_settle(u);end loop;
end $$;
revoke all on function colorwin_private.lottery_settle_due() from public,anon,authenticated;
select cron.schedule('colorwin-lottery-settle','* * * * *','select colorwin_private.lottery_settle_due();');
