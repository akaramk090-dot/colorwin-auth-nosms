-- Read-only subordinate activity. No rebate rates, settlement or wallet writes.
begin;
create or replace function colorwin_private.promotion_report(p_day date,p_tier integer,p_uid text,p_page integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare caller uuid:=auth.uid(); start_at timestamptz; end_at timestamptz; result jsonb;
begin
 perform colorwin_private.assert_player_session();
 if caller is null then raise exception 'Authentication required'; end if;
 if p_day is null or p_day < date '2020-01-01' or p_day > (now() at time zone 'Asia/Kolkata')::date then raise exception 'Invalid report date'; end if;
 if p_tier is null or p_tier not between 0 and 6 or p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid report filters'; end if;
 p_uid:=coalesce(trim(p_uid),'');
 if p_uid<>'' and p_uid !~ '^[0-9]{1,20}$' then raise exception 'Enter a valid subordinate UID'; end if;
 start_at:=p_day::timestamp at time zone 'Asia/Kolkata';end_at:=(p_day+1)::timestamp at time zone 'Asia/Kolkata';
 with recursive team as (
  select p.id,p.public_uid,p.created_at,1 as tier,array[caller,p.id] as visited from public.profiles p where p.inviter_id=caller
  union all
  select p.id,p.public_uid,p.created_at,t.tier+1,t.visited||p.id from public.profiles p join team t on p.inviter_id=t.id where t.tier<6 and not p.id=any(t.visited)
 ), selected as materialized (
  select * from team where created_at<end_at and (p_tier=0 or tier=p_tier) and (p_uid='' or public_uid::text=p_uid)
 ), activity as (
  select b.user_id,b.stake as amount from colorwin_private.wingo_bets b join selected s on s.id=b.user_id where b.created_at>=start_at and b.created_at<end_at and b.status in ('pending','won','lost')
  union all select b.user_id,b.stake from colorwin_private.lottery_bets b join selected s on s.id=b.user_id where b.created_at>=start_at and b.created_at<end_at and b.status in ('pending','won','lost')
  union all select b.user_id,b.amount from colorwin_private.arcade_bets b join selected s on s.id=b.user_id where b.created_at>=start_at and b.created_at<end_at and b.status in ('active','cashed','lost')
  union all select b.user_id,b.bet from colorwin_private.mines_rounds b join selected s on s.id=b.user_id where b.created_at>=start_at and b.created_at<end_at and b.status in ('active','cashed','lost')
 ), wagers as (
  select user_id,count(*) bet_count,sum(amount) bet_amount from activity group by user_id
 ), deposits as (
  select d.user_id,count(*) deposit_count,sum(d.amount) deposit_amount from public.promotion_deposits d join selected s on s.id=d.user_id where d.completed_at>=start_at and d.completed_at<end_at group by d.user_id
 ), members as (
  select s.public_uid uid,s.tier,s.created_at,coalesce(d.deposit_count,0) deposit_count,coalesce(d.deposit_amount,0) deposit_amount,
  coalesce(w.bet_count,0) bet_count,coalesce(w.bet_amount,0) bet_amount,
  case when f.completed_at>=start_at and f.completed_at<end_at then 1 else 0 end first_deposit_count,
  case when f.completed_at>=start_at and f.completed_at<end_at then f.amount else 0 end first_deposit_amount
  from selected s left join wagers w on w.user_id=s.id left join deposits d on d.user_id=s.id
  left join lateral (select amount,completed_at from public.promotion_deposits where user_id=s.id order by completed_at,id limit 1) f on true
 ), page_rows as (select * from members order by created_at desc,uid desc limit 20 offset ((p_page-1)*20))
 select jsonb_build_object('day',p_day,'timezone','Asia/Kolkata','tier',p_tier,'page',p_page,'page_size',20,
 'total',(select count(*) from members),'has_more',(select count(*) from members)>p_page*20,
 'betting_connected',true,'commission_connected',false,
 'summary',(select jsonb_build_object('deposit_count',coalesce(sum(deposit_count),0),'deposit_amount',coalesce(sum(deposit_amount),0),
 'bettors',count(*) filter(where bet_count>0),'bet_count',coalesce(sum(bet_count),0),'bet_amount',coalesce(sum(bet_amount),0),
 'first_deposits',coalesce(sum(first_deposit_count),0),'first_deposit_amount',coalesce(sum(first_deposit_amount),0)) from members),
 'members',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('commission',null,'report_day',p_day) order by p.created_at desc,p.uid desc) from page_rows p),'[]'::jsonb)) into result;
 return result;
end;
$$;
revoke all on function colorwin_private.promotion_report(date,integer,text,integer) from public,anon,authenticated;
grant execute on function colorwin_private.promotion_report(date,integer,text,integer) to authenticated;
create or replace function public.colorwin_promotion_report(p_day date,p_tier integer default 0,p_uid text default '',p_page integer default 1)
returns jsonb language sql stable security invoker set search_path='' as $$ select colorwin_private.promotion_report(p_day,p_tier,p_uid,p_page); $$;
revoke all on function public.colorwin_promotion_report(date,integer,text,integer) from public,anon;
grant execute on function public.colorwin_promotion_report(date,integer,text,integer) to authenticated;
commit;
