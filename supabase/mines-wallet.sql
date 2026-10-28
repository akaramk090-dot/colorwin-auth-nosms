create table colorwin_private.mines_rounds(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),request_id uuid not null,
 bet numeric(14,2) not null check(bet between 1 and 10000),mine_count integer not null check(mine_count between 1 and 24),
 mines integer[] not null,opened integer[] not null default '{}',status text not null default 'active' check(status in ('active','lost','cashed')),
 payout numeric(18,2) not null default 0,created_at timestamptz not null default now(),ended_at timestamptz,
 unique(user_id,request_id));
create unique index mines_one_active on colorwin_private.mines_rounds(user_id) where status='active';
create index mines_user_recent on colorwin_private.mines_rounds(user_id,created_at desc);
alter table colorwin_private.mines_rounds enable row level security;
revoke all on colorwin_private.mines_rounds from public,anon,authenticated;
create function colorwin_private.mines_factor(c integer,k integer) returns numeric language plpgsql immutable set search_path='' as $$
declare p numeric:=1;j integer;begin
 if k=0 then return 1;end if;
 if c=3 then
 if k=1 then return 1.13;elsif k=2 then return 1.31;elsif k=3 then return 1.56;elsif k=4 then return 1.87;elsif k=5 then return 2.27;elsif k=10 then return 8.93;elsif k between 6 and 9 then return round(2.27*power(8.93/2.27,(k-5)::numeric/5),2);end if;end if;
 for j in 0..k-1 loop p:=p*(25-c-j)::numeric/(25-j);end loop;
 return trunc(.97/p,2);
end $$;
revoke all on function colorwin_private.mines_factor(integer,integer) from public,anon,authenticated;
create function colorwin_private.mines_action(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=colorwin_private.assert_active();r colorwin_private.mines_rounds;b numeric;c integer;i integer;bal numeric;k integer;request uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,94));
 if p_action='start' then
 request:=(p_data->>'request_id')::uuid;if request is null then raise exception 'Missing request ID';end if;
 select * into r from colorwin_private.mines_rounds where user_id=u and request_id=request;
 if not found then
 if exists(select 1 from colorwin_private.mines_rounds where user_id=u and status='active') then raise exception 'Finish your active round first';end if;
 b:=(p_data->>'amount')::numeric;c:=(p_data->>'mines')::integer;
 if b is null or b<1 or b>10000 or b<>round(b,2) or c is null or c not in (1,3,5,7,10,15,20,24) then raise exception 'Invalid bet amount or mine count';end if;
 select coalesce(sum(amount),0) into bal from public.account_wallet_ledger where user_id=u;if bal<b then raise exception 'Insufficient wallet balance';end if;
 insert into colorwin_private.mines_rounds(user_id,request_id,bet,mine_count,mines) values(u,request,b,c,array(select n from generate_series(0,24)n order by extensions.gen_random_bytes(16) limit c)) returning * into r;
 insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,-b,'game_bet','mines-bet:'||r.id);
 insert into public.account_game_records(id,user_id,category,game_name,bet,winnings) values(r.id,u,'video','Mines',b,0);
 end if;
 elsif p_action='load' then
 select * into r from colorwin_private.mines_rounds where user_id=u order by created_at desc,id desc limit 1;
 elsif p_action in ('pick','cash') then
 select * into r from colorwin_private.mines_rounds where id=(p_data->>'id')::uuid and user_id=u for update;
 if not found then raise exception 'Round not found';end if;
 if r.status='active' then
 if p_action='pick' then
 i:=(p_data->>'tile')::integer;if i is null or i not between 0 and 24 then raise exception 'Invalid tile';end if;
 if not i=any(r.opened) then
 if i=any(r.mines) then r.status:='lost';r.ended_at:=now();
 else r.opened:=array_append(r.opened,i);end if;
 end if;
 end if;
 if r.status='active' and (p_action='cash' or cardinality(r.opened)=25-r.mine_count) then
 if cardinality(r.opened)=0 then raise exception 'Open a safe tile before cash out';end if;
 r.payout:=trunc(r.bet*colorwin_private.mines_factor(r.mine_count,cardinality(r.opened)),2);r.status:='cashed';r.ended_at:=now();
 insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,r.payout,'game_win','mines-win:'||r.id);
 update public.account_game_records set winnings=r.payout where id=r.id;
 end if;
 update colorwin_private.mines_rounds set opened=r.opened,status=r.status,payout=r.payout,ended_at=r.ended_at where id=r.id;
 end if;
 else raise exception 'Unknown Mines action';end if;
 select coalesce(sum(amount),0) into bal from public.account_wallet_ledger where user_id=u;
 if r.id is null then return jsonb_build_object('balance',bal,'round',null);end if;
 k:=cardinality(r.opened);
 return jsonb_build_object('balance',bal,'round',jsonb_build_object('id',r.id,'bet',r.bet,'mine_count',r.mine_count,'opened',r.opened,'status',r.status,'payout',r.payout,'multiplier',colorwin_private.mines_factor(r.mine_count,k),'next_multiplier',case when k<25-r.mine_count then colorwin_private.mines_factor(r.mine_count,k+1) else colorwin_private.mines_factor(r.mine_count,k) end,'mines',case when r.status<>'active' then to_jsonb(r.mines) else '[]'::jsonb end));
end $$;
revoke all on function colorwin_private.mines_action(text,jsonb) from public,anon;
grant execute on function colorwin_private.mines_action(text,jsonb) to authenticated;
create function public.colorwin_mines(p_action text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.mines_action(p_action,p_data);$$;
revoke all on function public.colorwin_mines(text,jsonb) from public,anon;
grant execute on function public.colorwin_mines(text,jsonb) to authenticated;

