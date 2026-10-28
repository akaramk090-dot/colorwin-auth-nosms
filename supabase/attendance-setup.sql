-- Seven-step attendance; approvals and claim dates use Asia/Kolkata calendar days.
create table colorwin_private.attendance_claims (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 day integer not null check(day between 1 and 7),
 claimed_on date not null,
 approved_total numeric(14,2) not null,
 reward numeric(14,2) not null check(reward>0),
 created_at timestamptz not null default now(),
 unique(user_id,day), unique(user_id,claimed_on)
);
alter table colorwin_private.attendance_claims enable row level security;
revoke all on colorwin_private.attendance_claims from public,anon,authenticated;
create index cw_attendance_approved_day on public.cw_deposit_requests(user_id,reviewed_at) where status='complete';

create or replace function colorwin_private.attendance(p_claim boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=colorwin_private.assert_active();
 today date:=(statement_timestamp() at time zone 'Asia/Kolkata')::date;
 thresholds numeric[]:=array[300,1000,10000,50000,100000,500000,1000000];
 rewards numeric[]:=array[5,18,100,200,400,3000,7000];
 n integer; last_day date; total numeric; earned numeric; claim_id uuid; reason text;
begin
 if p_claim then perform pg_advisory_xact_lock(hashtextextended('attendance:'||u::text,0));end if;
 select count(*),max(claimed_on),coalesce(sum(reward),0) into n,last_day,earned
 from colorwin_private.attendance_claims where user_id=u;
 select coalesce(sum(amount),0) into total from public.cw_deposit_requests
 where user_id=u and status='complete'
 and reviewed_at >= (today::timestamp at time zone 'Asia/Kolkata')
 and reviewed_at < ((today+1)::timestamp at time zone 'Asia/Kolkata');
 reason:=case when n=7 then 'completed' when last_day>=today then 'claimed_today'
 when total<thresholds[n+1] then 'deposit_required' else 'eligible' end;
 if p_claim and reason='eligible' then
  insert into colorwin_private.attendance_claims(user_id,day,claimed_on,approved_total,reward)
  values(u,n+1,today,total,rewards[n+1]) returning id into claim_id;
  insert into public.account_wallet_ledger(user_id,amount,source,reference)
  values(u,rewards[n+1],'attendance','attendance:'||claim_id::text);
  earned:=earned+rewards[n+1];n:=n+1;
  reason:=case when n=7 then 'completed' else 'claimed_today' end;
 elsif p_claim and reason='deposit_required' then
  raise exception 'Today’s approved deposits do not meet the required amount' using errcode='22023';
 end if;
 return jsonb_build_object('claimed_days',n,'earned',earned,'approved_today',total,
 'next_day',least(n+1,7),'required',case when n<7 then thresholds[n+1] else 0 end,
 'reward',case when n<7 then rewards[n+1] else 0 end,'reason',reason,'eligible',reason='eligible',
 'history',(select coalesce(jsonb_agg(jsonb_build_object('day',day,'date',claimed_on,'reward',reward,'approved_total',approved_total) order by day desc),'[]'::jsonb)
 from colorwin_private.attendance_claims where user_id=u));
end $$;
create or replace function public.colorwin_attendance(p_claim boolean default false)
returns jsonb language sql security invoker set search_path='' as $$
 select colorwin_private.attendance(p_claim);
$$;
revoke all on function colorwin_private.attendance(boolean) from public,anon;
revoke all on function public.colorwin_attendance(boolean) from public,anon;
grant execute on function colorwin_private.attendance(boolean),public.colorwin_attendance(boolean) to authenticated;
notify pgrst,'reload schema';
