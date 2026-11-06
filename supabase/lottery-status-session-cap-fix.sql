create or replace function colorwin_private.lottery_status_access(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg colorwin_private.lottery_status_config;raw_token text;v_token_hash text;k text;
 g text;ln integer;ri bigint;current_ri bigint;moment timestamptz:=clock_timestamp();stamp numeric:=extract(epoch from moment);
 totals jsonb;selections jsonb;overview jsonb;rounds jsonb;lane_list integer[];remaining numeric;expiry timestamptz;
begin
 if p_action='login' then
  select * into cfg from colorwin_private.lottery_status_config where singleton for update;
  if cfg.blocked_until>moment then return jsonb_build_object('ok',false,'code','rate_limited','error','Too many attempts. Try again in one minute.');end if;
  if cfg.window_started<moment-interval '1 minute' then
   update colorwin_private.lottery_status_config set failures=0,window_started=moment,blocked_until=null where singleton;
   cfg.failures:=0;
  end if;
  k:=p_data->>'key';
  if k is null or length(k) not between 16 and 512 or cfg.key_hash is null or
     encode(extensions.digest(cfg.salt||coalesce(k,''),'sha256'),'hex') is distinct from cfg.key_hash then
   update colorwin_private.lottery_status_config set failures=failures+1,
    blocked_until=case when failures+1>=15 then moment+interval '1 minute' else null end where singleton;
   return jsonb_build_object('ok',false,'code','invalid_key','error','Incorrect access key.');
  end if;
  update colorwin_private.lottery_status_config set failures=0,window_started=moment,blocked_until=null where singleton;
  raw_token:=encode(extensions.gen_random_bytes(32),'hex');expiry:=moment+interval '8 hours';
  delete from colorwin_private.lottery_status_sessions where expires_at<=moment or key_version<>cfg.key_version;
  delete from colorwin_private.lottery_status_sessions stale where stale.token_hash in
   (select s.token_hash from colorwin_private.lottery_status_sessions s order by s.created_at desc offset 19);
  insert into colorwin_private.lottery_status_sessions(token_hash,key_version,expires_at)
   values(encode(extensions.digest(raw_token,'sha256'),'hex'),cfg.key_version,expiry);
  return jsonb_build_object('ok',true,'session',raw_token,'expires_at',expiry,'read_only',true);
 end if;

 raw_token:=p_data->>'session';
 if raw_token is null or raw_token !~ '^[a-f0-9]{64}$' then
  return jsonb_build_object('ok',false,'code','unauthorized','error','Sign in to the game status panel.');
 end if;
 v_token_hash:=encode(extensions.digest(raw_token,'sha256'),'hex');
 if not exists(select 1 from colorwin_private.lottery_status_sessions s join colorwin_private.lottery_status_config c
  on c.key_version=s.key_version where s.token_hash=v_token_hash and s.expires_at>moment) then
  return jsonb_build_object('ok',false,'code','unauthorized','error','Session expired. Sign in again.');
 end if;
 if p_action='logout' then
  delete from colorwin_private.lottery_status_sessions s where s.token_hash=v_token_hash;
  return jsonb_build_object('ok',true);
 end if;
 if p_action<>'status' or p_action is null then return jsonb_build_object('ok',false,'code','unsupported','error','This panel only provides game status.');end if;
 g:=coalesce(p_data->>'game','wingo');ln:=coalesce((p_data->>'lane')::integer,30);
 if g not in('wingo','k3','5d','trx-wingo') or (g='wingo' and ln not in(30,60,180,300)) or (g<>'wingo' and ln not in(60,180,300,600)) then
  return jsonb_build_object('ok',false,'code','invalid_filter','error','Invalid game or duration.');
 end if;
 current_ri:=floor(stamp/ln);ri:=coalesce((p_data->>'round')::bigint,current_ri);
 if ri<greatest(0,current_ri-1000) or ri>current_ri then return jsonb_build_object('ok',false,'code','invalid_round','error','Select a recent or current round.');end if;
 remaining:=greatest(0,(ri+1)*ln-stamp);lane_list:=case when g='wingo' then array[30,60,180,300] else array[60,180,300,600] end;

 select jsonb_build_object('bets',count(*),'orders',count(distinct b.order_id),'players',count(distinct b.user_id),
  'amount',coalesce(sum(b.stake),0),'pending',count(*) filter(where b.status='pending'),
  'won',count(*) filter(where b.status='won'),'lost',count(*) filter(where b.status='lost'))
 into totals from colorwin_private.lottery_status_rows(g,ln,ri)b;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.amount desc,x.selection),'[]'::jsonb) into selections from
  (select b.selection,count(*) as bets,count(distinct b.order_id) as orders,count(distinct b.user_id) as players,sum(b.stake) as amount
   from colorwin_private.lottery_status_rows(g,ln,ri)b group by b.selection)x;
 select jsonb_agg(jsonb_build_object('lane',l.lane,'round',floor(stamp/l.lane)::bigint,
  'period',colorwin_private.lottery_status_period(g,l.lane,floor(stamp/l.lane)::bigint),
  'bets',x.bets,'amount',x.amount,'players',x.players) order by l.lane) into overview
 from unnest(lane_list)l(lane) cross join lateral
  (select count(*) as bets,coalesce(sum(b.stake),0) as amount,count(distinct b.user_id) as players
   from colorwin_private.lottery_status_rows(g,l.lane,floor(stamp/l.lane)::bigint)b)x;
 select jsonb_agg(jsonb_build_object('round',x.round_index,'period',colorwin_private.lottery_status_period(g,ln,x.round_index)) order by x.round_index desc)
 into rounds from (
  select distinct recent.round_index from (
   select current_ri as round_index union all select ri union all
   (select distinct b.round_index from colorwin_private.wingo_bets b where g='wingo' and b.lane=ln and b.round_index between greatest(0,current_ri-1000) and current_ri order by b.round_index desc limit 20)
   union all
   (select distinct b.round_index from colorwin_private.lottery_bets b where g<>'wingo' and b.game=g and b.lane=ln and b.round_index between greatest(0,current_ri-1000) and current_ri order by b.round_index desc limit 20)
  )recent order by recent.round_index desc limit 21
 )x;
 return jsonb_build_object('ok',true,'read_only',true,'game',g,'lane',ln,'server_ms',floor(stamp*1000),
  'round',ri,'current_round',current_ri,'period',colorwin_private.lottery_status_period(g,ln,ri),'remaining',remaining,
  'betting_open',ri=current_ri and remaining>case when g='wingo' then 5 else 6 end,
  'totals',totals,'selections',selections,'overview',overview,'rounds',rounds,'result_mode','server-random');
end $$;