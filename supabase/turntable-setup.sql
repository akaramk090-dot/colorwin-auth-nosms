begin;
create table colorwin_private.wheel_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 choice smallint not null check(choice between 1 and 4),
 balance numeric(14,2) not null default 475 check(balance>=0),
 spins_used integer not null default 0 check(spins_used>=0),
 created_at timestamptz not null default now()
);
create table colorwin_private.wheel_events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references colorwin_private.wheel_accounts(user_id) on delete cascade,
 request_id uuid not null, kind text not null check(kind in ('spin','claim')),
 amount numeric(14,2) not null check(amount>0),
 segment smallint check(segment between 0 and 7),
 created_at timestamptz not null default now(), unique(user_id,request_id),
 check((kind='spin' and segment is not null) or (kind='claim' and segment is null))
);
create index wheel_events_owner_time on colorwin_private.wheel_events(user_id,created_at desc);
create index wheel_inviter_time on public.profiles(inviter_id,created_at);
alter table colorwin_private.wheel_accounts enable row level security;
alter table colorwin_private.wheel_events enable row level security;
revoke all on colorwin_private.wheel_accounts,colorwin_private.wheel_events from public,anon,authenticated;
create function colorwin_private.wheel_action(p_action text,p_choice integer default null,p_request uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); a colorwin_private.wheel_accounts%rowtype; e colorwin_private.wheel_events%rowtype; invites integer; idx integer; prize integer; result jsonb;
begin
 if u is null then raise exception 'Sign in to continue'; end if;
 if p_action is null or p_action not in ('state','start','spin','claim') then raise exception 'Invalid wheel action'; end if;
 if p_action='start' then
  if p_choice is null or p_choice not between 1 and 4 then raise exception 'Choose a valid box'; end if;
  insert into colorwin_private.wheel_accounts(user_id,choice) values(u,p_choice) on conflict(user_id) do nothing;
 end if;
 select * into a from colorwin_private.wheel_accounts where user_id=u for update;
 if not found then
  if p_action<>'state' then raise exception 'Choose your starting reward first'; end if;
  return jsonb_build_object('choice',null,'balance',0,'spins',0,'records','[]'::jsonb,'claims','[]'::jsonb,'claimed_count',0);
 end if;
 select count(*) into invites from public.profiles where inviter_id=u and created_at>=a.created_at;
 if p_action in ('spin','claim') then
  if p_request is null then raise exception 'Request ID required'; end if;
  select * into e from colorwin_private.wheel_events where user_id=u and request_id=p_request;
  if found then
   if e.kind<>p_action then raise exception 'Request ID already used'; end if;
  else
   if p_action='spin' then
    if a.spins_used>=1+invites then raise exception 'Invite a friend who registers with your link to get another spin'; end if;
    idx:=mod(('x'||substr(gen_random_uuid()::text,1,8))::bit(32)::bigint,8)::integer;
    prize:=(array[45,40,25,30,35,20,10,20])[idx+1];
    insert into colorwin_private.wheel_events(user_id,request_id,kind,amount,segment) values(u,p_request,'spin',prize,idx) returning * into e;
    update colorwin_private.wheel_accounts set balance=balance+prize,spins_used=spins_used+1 where user_id=u returning * into a;
   else
    if a.balance<500 then raise exception 'Reach ₹500 before claiming'; end if;
    insert into colorwin_private.wheel_events(user_id,request_id,kind,amount) values(u,p_request,'claim',500) returning * into e;
    insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,500,'turntable','turntable:'||e.id::text);
    update colorwin_private.wheel_accounts set balance=balance-500 where user_id=u returning * into a;
   end if;
  end if;
 end if;
 result:=jsonb_build_object('choice',a.choice,'balance',a.balance,'started_at',a.created_at,'spins',greatest(0,1+invites-a.spins_used),
 'claimed_count',(select count(*) from colorwin_private.wheel_events where user_id=u and kind='claim'),
 'records',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from (select id,kind,amount,segment,created_at from colorwin_private.wheel_events where user_id=u and kind='spin' order by created_at desc limit 100) t),'[]'::jsonb),
 'claims',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from (select id,amount,created_at from colorwin_private.wheel_events where user_id=u and kind='claim' order by created_at desc limit 100) t),'[]'::jsonb));
 if e.id is not null then result:=result||jsonb_build_object('outcome',jsonb_build_object('id',e.id,'kind',e.kind,'amount',e.amount,'segment',e.segment)); end if;
 return result;
end $$;
revoke all on function colorwin_private.wheel_action(text,integer,uuid) from public,anon,authenticated;
grant execute on function colorwin_private.wheel_action(text,integer,uuid) to authenticated;
create function public.colorwin_wheel(p_action text default 'state',p_choice integer default null,p_request uuid default null)
returns jsonb language sql security invoker set search_path='' as $$ select colorwin_private.wheel_action(p_action,p_choice,p_request); $$;
revoke all on function public.colorwin_wheel(text,integer,uuid) from public,anon,authenticated;
grant execute on function public.colorwin_wheel(text,integer,uuid) to authenticated;
commit;

