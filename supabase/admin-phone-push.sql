create extension if not exists pg_net;
create extension if not exists pg_cron;
create table colorwin_private.admin_push_config(singleton boolean primary key default true check(singleton),public_key text not null,private_key text not null,worker_secret text not null,origin text not null);
create table colorwin_private.admin_push_subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),endpoint text not null unique,subscription jsonb not null,origin text not null,key_version bigint not null,enabled boolean not null default true,created_at timestamptz not null default now());
create table colorwin_private.admin_push_events(id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('deposit','withdrawal')),request_id uuid not null,amount numeric not null,created_at timestamptz not null default now(),unique(kind,request_id));
create table colorwin_private.admin_push_deliveries(event_id uuid references colorwin_private.admin_push_events(id),subscription_id uuid references colorwin_private.admin_push_subscriptions(id),status text not null default 'pending',attempts integer not null default 0,claimed_at timestamptz,primary key(event_id,subscription_id));
create index admin_push_pending on colorwin_private.admin_push_deliveries(status,claimed_at) where status in ('pending','sending');
alter table colorwin_private.admin_push_config enable row level security;
alter table colorwin_private.admin_push_subscriptions enable row level security;
alter table colorwin_private.admin_push_events enable row level security;
alter table colorwin_private.admin_push_deliveries enable row level security;
revoke all on colorwin_private.admin_push_config,colorwin_private.admin_push_subscriptions,colorwin_private.admin_push_events,colorwin_private.admin_push_deliveries from public,anon,authenticated;
create function colorwin_private.wake_admin_push() returns void language plpgsql security definer set search_path='' as $$
declare cfg colorwin_private.admin_push_config;begin select * into cfg from colorwin_private.admin_push_config where singleton;
if cfg.singleton is not null then perform net.http_post(url:='https://lwzqbhmdfkbycdizieff.supabase.co/functions/v1/admin-push-worker',headers:=jsonb_build_object('Content-Type','application/json','x-cw-push-secret',cfg.worker_secret),body:='{}'::jsonb,timeout_milliseconds:=10000);end if;end $$;
revoke all on function colorwin_private.wake_admin_push() from public,anon,authenticated;
create function colorwin_private.queue_admin_finance_push() returns trigger language plpgsql security definer set search_path='' as $$
declare event uuid;k text;begin
if new.status='pending' and (tg_op='INSERT' or old.status is distinct from 'pending') then
k:=case when tg_table_name='cw_deposit_requests' then 'deposit' else 'withdrawal' end;
insert into colorwin_private.admin_push_events(kind,request_id,amount) values(k,new.id,new.amount) on conflict do nothing returning id into event;
if event is not null then
insert into colorwin_private.admin_push_deliveries(event_id,subscription_id) select event,s.id from colorwin_private.admin_push_subscriptions s join colorwin_private.admin_token_config c on c.version=s.key_version and c.singleton where s.enabled;
perform colorwin_private.wake_admin_push();end if;end if;return new;end $$;
revoke all on function colorwin_private.queue_admin_finance_push() from public,anon,authenticated;
create trigger admin_deposit_push after insert or update of status on public.cw_deposit_requests for each row execute function colorwin_private.queue_admin_finance_push();
create trigger admin_withdraw_push after insert or update of status on public.cw_withdraw_requests for each row execute function colorwin_private.queue_admin_finance_push();
create function public.colorwin_admin_push(p_session text,p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare access jsonb;u uuid;v bigint;cfg colorwin_private.admin_push_config;ep text;sub jsonb;site text;begin
access:=colorwin_private.admin_key_gateway('status',p_session,'{}');if coalesce((access->>'ok')::boolean,false) is not true then raise exception 'ADMIN_TOKEN_REQUIRED: Unlock the admin panel first';end if;
select user_id,version into u,v from colorwin_private.admin_key_sessions where session_hash=encode(extensions.digest(p_session,'sha256'),'hex');
select * into cfg from colorwin_private.admin_push_config where singleton;
if p_action='key' then return jsonb_build_object('publicKey',cfg.public_key);end if;
ep:=p_data->>'endpoint';
if p_action='subscribe' then
sub:=p_data->'subscription';ep:=sub->>'endpoint';site:=p_data->>'origin';
if site not in (cfg.origin,'http://localhost:5173','http://localhost:5174','http://127.0.0.1:5173','http://127.0.0.1:5174') or site is null then raise exception 'Open notifications on the configured HTTPS admin link';end if;
if ep is null or length(ep)>2000 or ep !~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|[A-Za-z0-9-]+[.]notify[.]windows[.]com)/' or coalesce(sub->'keys'->>'p256dh','') !~ '^[A-Za-z0-9_-]{80,100}$' or coalesce(sub->'keys'->>'auth','') !~ '^[A-Za-z0-9_-]{20,30}$' then raise exception 'Invalid browser push subscription';end if;
if (select count(*) from colorwin_private.admin_push_subscriptions where user_id=u and enabled)>=10 and not exists(select 1 from colorwin_private.admin_push_subscriptions where endpoint=ep and user_id=u) then raise exception 'Maximum 10 enabled devices';end if;
insert into colorwin_private.admin_push_subscriptions(user_id,endpoint,subscription,origin,key_version) values(u,ep,sub,site,v)
on conflict(endpoint) do update set user_id=excluded.user_id,subscription=excluded.subscription,origin=excluded.origin,key_version=excluded.key_version,enabled=true;
return jsonb_build_object('enabled',true);
elsif p_action='status' then return jsonb_build_object('enabled',exists(select 1 from colorwin_private.admin_push_subscriptions where user_id=u and endpoint=ep and enabled and key_version=v));
 elsif p_action='unsubscribe' then update colorwin_private.admin_push_subscriptions set enabled=false where user_id=u and endpoint=ep;return jsonb_build_object('enabled',false);
elsif p_action='test' then return coalesce((select jsonb_build_object('subscription',subscription,'origin',origin) from colorwin_private.admin_push_subscriptions where endpoint=ep and user_id=u and enabled and key_version=v),'{}');
end if;raise exception 'Unknown push action';end $$;
revoke all on function public.colorwin_admin_push(text,text,jsonb) from public,anon,authenticated;grant execute on function public.colorwin_admin_push(text,text,jsonb) to service_role;
create function public.colorwin_admin_push_backend(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare value jsonb;begin
if p_action='config' then return (select jsonb_build_object('publicKey',public_key,'privateKey',private_key,'secret',worker_secret,'origin',origin) from colorwin_private.admin_push_config where singleton);
elsif p_action='claim' then
with picked as (select d.event_id,d.subscription_id from colorwin_private.admin_push_deliveries d
join colorwin_private.admin_push_subscriptions s on s.id=d.subscription_id join colorwin_private.admin_token_config c on c.singleton and c.version=s.key_version
join colorwin_private.admin_members m on m.user_id=s.user_id and m.active and m.role='owner' join public.profiles p on p.id=s.user_id and not p.is_blocked
where s.enabled and d.attempts<5 and (d.status='pending' or (d.status='sending' and d.claimed_at<now()-interval '90 seconds'))
and (d.claimed_at is null or d.claimed_at<now()-interval '1 minute') order by d.event_id limit 40 for update of d skip locked),
claimed as (update colorwin_private.admin_push_deliveries d set status='sending',attempts=attempts+1,claimed_at=now() from picked where d.event_id=picked.event_id and d.subscription_id=picked.subscription_id returning d.event_id,d.subscription_id)
select coalesce(jsonb_agg(jsonb_build_object('event_id',c.event_id,'subscription_id',c.subscription_id,'kind',e.kind,'amount',e.amount,'subscription',s.subscription,'origin',s.origin)),'[]') into value from claimed c join colorwin_private.admin_push_events e on e.id=c.event_id join colorwin_private.admin_push_subscriptions s on s.id=c.subscription_id;return value;
elsif p_action='ack' then
update colorwin_private.admin_push_deliveries set status=case when p_data->>'result'='sent' then 'sent' when p_data->>'result'='gone' then 'gone' else 'pending' end where event_id=(p_data->>'event_id')::uuid and subscription_id=(p_data->>'subscription_id')::uuid;
if p_data->>'result'='gone' then update colorwin_private.admin_push_subscriptions set enabled=false where id=(p_data->>'subscription_id')::uuid;end if;return '{"ok":true}';
end if;raise exception 'Unknown backend action';end $$;
revoke all on function public.colorwin_admin_push_backend(text,jsonb) from public,anon,authenticated;grant execute on function public.colorwin_admin_push_backend(text,jsonb) to service_role;
select cron.schedule('colorwin-admin-push-retry','* * * * *','select colorwin_private.wake_admin_push()');

