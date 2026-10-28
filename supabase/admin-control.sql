-- Color Win operations. Apply with Supabase apply_migration as postgres.
begin;
alter table public.profiles add column if not exists is_blocked boolean not null default false;
create table colorwin_private.admin_members(user_id uuid primary key references auth.users(id), role text not null check(role in ('owner','finance','support','tournaments','content')), active boolean not null default true, created_at timestamptz not null default now());
create table colorwin_private.admin_audit(id bigint generated always as identity primary key, actor uuid not null, action text not null, target text, before_data jsonb, after_data jsonb, reason text not null, created_at timestamptz not null default now());
create table colorwin_private.site_settings(key text primary key, value jsonb not null, updated_at timestamptz not null default now());
insert into colorwin_private.site_settings values
 ('payments','{"enabled":true,"receiverName":"Color Win","upiIds":["salmanrewa17@naviaxis","7240932684@yesfam","7240932684@superyes","9981151187xdanis@axl","mukeshambani09@ptaxis","mukeshambani09@ptyes","salmanrewa17@nyes"],"minDeposit":100,"maxDeposit":50000,"minWithdraw":100,"maxWithdraw":50000}',now()),
 ('promotion','{"enabled":true,"telegram":"https://t.me/"}',now()),
 ('site','{"maintenance":false,"supportEnabled":true,"tournamentsEnabled":true}',now());
create table public.cw_deposit_requests(id uuid primary key default gen_random_uuid(), number text not null unique default ('RC'||upper(replace(gen_random_uuid()::text,'-',''))), user_id uuid not null references public.profiles(id), amount numeric(14,2) not null check(amount>0), method text not null, recipient_upi text not null, recipient_name text not null, utr text, status text not null default 'to be paid' check(status in ('to be paid','pending','complete','rejected','cancelled')), review_note text not null default '', reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '10 minutes');
create unique index cw_deposit_utr_unique on public.cw_deposit_requests(utr) where utr is not null;
create index cw_deposit_owner on public.cw_deposit_requests(user_id,created_at desc);
create index cw_deposit_queue on public.cw_deposit_requests(status,created_at desc);
create table public.cw_payout_methods(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),kind text not null check(kind in ('upi','bank','usdt')),details jsonb not null,active boolean not null default true,created_at timestamptz not null default now());
create index cw_payout_owner on public.cw_payout_methods(user_id,active);
create table public.cw_withdraw_requests(id uuid primary key default gen_random_uuid(),number text not null unique default ('WD'||upper(replace(gen_random_uuid()::text,'-',''))),user_id uuid not null references public.profiles(id),amount numeric(14,2) not null check(amount>0),method_id uuid not null references public.cw_payout_methods(id),payout_snapshot jsonb not null,status text not null default 'pending' check(status in ('pending','processing','paid','rejected')),payout_reference text,review_note text not null default '',reviewed_by uuid,reviewed_at timestamptz,created_at timestamptz not null default now());
create unique index cw_withdraw_reference_unique on public.cw_withdraw_requests(payout_reference) where payout_reference is not null;
create index cw_withdraw_owner on public.cw_withdraw_requests(user_id,created_at desc);
create index cw_withdraw_queue on public.cw_withdraw_requests(status,created_at desc);
create table public.cw_tournaments(id uuid primary key default gen_random_uuid(),title text not null check(char_length(title) between 3 and 100),game text not null check(game in ('ff','pubg')),mode text not null check(mode in ('Solo','Duo','Squad')),status text not null default 'draft' check(status in ('draft','open','live','completed','cancelled')),banner text not null default 'assets/tournaments/free-fire-red.png',entry_fee numeric(14,2) not null default 0 check(entry_fee>=0),prize_pool numeric(14,2) not null default 0 check(prize_pool>=0),capacity integer not null check(capacity between 1 and 1000),starts_at timestamptz not null,rules text not null default '',created_at timestamptz not null default now());
create index cw_tournaments_status on public.cw_tournaments(status,starts_at);
create table colorwin_private.tournament_rooms(tournament_id uuid primary key references public.cw_tournaments(id),room_id text not null,password text not null);
create table public.cw_tournament_entries(id uuid primary key default gen_random_uuid(),tournament_id uuid not null references public.cw_tournaments(id),user_id uuid not null references public.profiles(id),player_id text not null,player_name text not null,status text not null default 'joined' check(status in ('joined','played','cancelled')),rank integer check(rank>0),reward numeric(14,2) not null default 0 check(reward>=0),reward_paid_at timestamptz,created_at timestamptz not null default now(),unique(tournament_id,user_id));
create index cw_entries_owner on public.cw_tournament_entries(user_id,created_at desc);
create table public.cw_announcements(id uuid primary key default gen_random_uuid(),title text not null check(char_length(title) between 3 and 100),message text not null check(char_length(message) between 3 and 5000),active boolean not null default true,created_at timestamptz not null default now());
create table public.cw_promotion_campaigns(id uuid primary key default gen_random_uuid(),title text not null check(char_length(title) between 3 and 100),description text not null default '',banner text not null default '',active boolean not null default false,created_at timestamptz not null default now());
create table colorwin_private.game_controls(game_id text primary key,enabled boolean not null default true,updated_at timestamptz not null default now());
do $$ declare t text;begin
 foreach t in array array['admin_members','admin_audit','site_settings','tournament_rooms','game_controls'] loop execute format('alter table colorwin_private.%I enable row level security',t);execute format('revoke all on colorwin_private.%I from public,anon,authenticated',t);end loop;
 foreach t in array array['cw_deposit_requests','cw_payout_methods','cw_withdraw_requests','cw_tournaments','cw_tournament_entries','cw_announcements','cw_promotion_campaigns'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);end loop;
 foreach t in array array['cw_deposit_requests','cw_payout_methods','cw_withdraw_requests','cw_tournament_entries'] loop execute format('create policy own_read on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);end loop;
end $$;
create policy published_tournaments on public.cw_tournaments for select to authenticated using(status<>'draft');
create policy published_announcements on public.cw_announcements for select to authenticated using(active);
create policy published_campaigns on public.cw_promotion_campaigns for select to authenticated using(active);

create function colorwin_private.assert_active() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();begin
 if u is null or not exists(select 1 from public.profiles where id=u and not is_blocked) then raise exception 'Account unavailable or suspended' using errcode='42501';end if;return u;
end $$;
create function colorwin_private.require_admin(p_scope text) returns text language plpgsql security definer set search_path='' as $$
declare r text;begin
 perform colorwin_private.assert_active();select role into r from colorwin_private.admin_members where user_id=auth.uid() and active;
 if r is null or (p_scope<>'read' and r<>'owner' and r<>p_scope) then raise exception 'Admin permission required' using errcode='42501';end if;return r;
end $$;
create function colorwin_private.log_admin(p_action text,p_target text,p_before jsonb,p_after jsonb,p_reason text) returns void language plpgsql set search_path='' as $$
begin insert into colorwin_private.admin_audit(actor,action,target,before_data,after_data,reason) values(auth.uid(),p_action,p_target,p_before,p_after,p_reason);end $$;

create function colorwin_private.wallet_action(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=colorwin_private.assert_active();cfg jsonb;d public.cw_deposit_requests;w public.cw_withdraw_requests;m public.cw_payout_methods;a numeric;bal numeric;input_details jsonb;utr_value text;receiver text;result jsonb;
begin
 select value into cfg from colorwin_private.site_settings where key='payments';
 if p_action='load' then return jsonb_build_object('deposits',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select * from public.cw_deposit_requests where user_id=u order by created_at desc limit 200)x),'[]'::jsonb),'withdrawals',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select * from public.cw_withdraw_requests where user_id=u order by created_at desc limit 200)x),'[]'::jsonb),'methods',coalesce((select jsonb_agg(to_jsonb(x)) from public.cw_payout_methods x where user_id=u and active),'[]'::jsonb),'balance',coalesce((select sum(amount) from public.account_wallet_ledger where user_id=u),0));end if;
 if p_action='create_deposit' then
  if nullif(p_data->>'request_id','') is null then raise exception 'Request id required';end if;
  if not coalesce((cfg->>'enabled')::boolean,false) then raise exception 'Deposits temporarily unavailable';end if;
  a:=(p_data->>'amount')::numeric;if a is null or a<>round(a,2) or a<(cfg->>'minDeposit')::numeric or a>(cfg->>'maxDeposit')::numeric then raise exception 'Deposit amount outside allowed range';end if;
  if p_data->>'method' not in ('upi','innate','paytm') then raise exception 'Unsupported payment method';end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,92));
  select * into d from public.cw_deposit_requests where user_id=u and client_request_id=(p_data->>'request_id')::uuid;if found then if d.amount<>a or d.method<>p_data->>'method' then raise exception 'Request id reused with different details';end if;return to_jsonb(d);end if;
  if (select count(*) from public.cw_deposit_requests where user_id=u and created_at>now()-interval '1 hour')>=20 then raise exception 'Too many deposit orders. Try later';end if;
  select value into receiver from jsonb_array_elements_text(cfg->'upiIds') order by random() limit 1;if receiver is null then raise exception 'Payment receiver unavailable';end if;
  insert into public.cw_deposit_requests(user_id,amount,method,recipient_upi,recipient_name,client_request_id) values(u,a,p_data->>'method',receiver,cfg->>'receiverName',(p_data->>'request_id')::uuid) returning * into d;return to_jsonb(d);
 elsif p_action in ('submit_utr','cancel_deposit') then
  select * into d from public.cw_deposit_requests where id=(p_data->>'id')::uuid and user_id=u for update;if not found then raise exception 'Deposit not found';end if;
  if p_action='submit_utr' then
   utr_value:=p_data->>'utr';if utr_value is null or utr_value !~ '^[0-9]{12}$' then raise exception 'Enter a 12-digit UTR';end if;
   if d.status='pending' and d.utr=utr_value then return to_jsonb(d);end if;
   if d.status<>'to be paid' then raise exception 'This deposit cannot accept a UTR';end if;
   update public.cw_deposit_requests set utr=utr_value,status='pending' where id=d.id returning * into d;
  else
   if d.status<>'to be paid' then raise exception 'Submitted deposits cannot be cancelled';end if;
   update public.cw_deposit_requests set status='cancelled',review_note=left(coalesce(p_data->>'reason','Cancelled by user'),300) where id=d.id returning * into d;
  end if;return to_jsonb(d);
 elsif p_action='save_method' then
  input_details:=p_data->'details';if input_details is null or jsonb_typeof(input_details)<>'object' or octet_length(input_details::text)>2000 then raise exception 'Invalid beneficiary';end if;
  if p_data->>'kind' not in ('upi','bank','usdt') then raise exception 'Invalid beneficiary type';end if;
  if p_data->>'kind'='usdt' then raise exception 'USDT withdrawals are not enabled';end if;
  if coalesce(char_length(input_details->>'name'),0) not between 2 and 100 then raise exception 'Enter beneficiary name';end if;
  if p_data->>'kind'='upi' and coalesce(input_details->>'account','') !~ '^[A-Za-z0-9._-]+@[A-Za-z][A-Za-z0-9.-]+$' then raise exception 'Invalid UPI';end if;
  if p_data->>'kind'='bank' and (coalesce(input_details->>'account','') !~ '^[0-9]{9,18}$' or coalesce(input_details->>'ifsc','') !~ '^[A-Z]{4}0[A-Z0-9]{6}$' or coalesce(char_length(input_details->>'bank'),0)<2) then raise exception 'Invalid bank details';end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,93));
  if exists(select 1 from public.cw_payout_methods where user_id=u and active and details->>'name'<>p_data->'details'->>'name') then raise exception 'Use your original beneficiary name';end if;
  if exists(select 1 from public.cw_payout_methods where user_id=u and active and kind=p_data->>'kind' and lower(details->>'account')=lower(p_data->'details'->>'account')) then raise exception 'Beneficiary already exists';end if;
  if (select count(*) from public.cw_payout_methods where user_id=u and active)>=10 then raise exception 'Beneficiary limit reached';end if;
  insert into public.cw_payout_methods(user_id,kind,details) values(u,p_data->>'kind',input_details) returning * into m;return to_jsonb(m);
 elsif p_action='withdraw' then
  if nullif(p_data->>'request_id','') is null then raise exception 'Request id required';end if;
  a:=(p_data->>'amount')::numeric;if not coalesce((cfg->>'enabled')::boolean,false) or a is null or a<>round(a,2) or a<(cfg->>'minWithdraw')::numeric or a>(cfg->>'maxWithdraw')::numeric then raise exception 'Withdrawal unavailable or amount outside allowed range';end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,94));
  select * into w from public.cw_withdraw_requests where user_id=u and client_request_id=(p_data->>'request_id')::uuid;if found then if w.amount<>a or w.method_id<>(p_data->>'method_id')::uuid then raise exception 'Request id reused with different details';end if;return to_jsonb(w);end if;
  select * into m from public.cw_payout_methods where id=(p_data->>'method_id')::uuid and user_id=u and active for update;if not found or m.kind='usdt' then raise exception 'Select an active INR beneficiary';end if;
  select coalesce(sum(amount),0) into bal from public.account_wallet_ledger where user_id=u;if bal<a then raise exception 'Insufficient withdrawable balance';end if;
  insert into public.cw_withdraw_requests(user_id,amount,method_id,payout_snapshot,client_request_id) values(u,a,m.id,jsonb_build_object('kind',m.kind,'details',m.details),(p_data->>'request_id')::uuid) returning * into w;
  insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,-a,'withdrawal_reserve','withdraw-reserve:'||w.id);return to_jsonb(w);
 end if;raise exception 'Unknown wallet action';
end $$;
create function public.colorwin_wallet(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.wallet_action(p_action,p_data)$$;

create function colorwin_private.admin_list(p_section text,p_search text,p_page integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=colorwin_private.require_admin('read');rows jsonb;total bigint;tbl text;off integer:=greatest(coalesce(p_page,0),0)*50;begin
 if off>100000 or char_length(coalesce(p_search,''))>100 then raise exception 'Invalid pagination';end if;
 if p_section='overview' then return jsonb_build_object('role',r,'users',(select count(*) from public.profiles),'pending_deposits',(select count(*) from public.cw_deposit_requests where status='pending'),'pending_withdrawals',(select count(*) from public.cw_withdraw_requests where status in ('pending','processing')),'pending_support',(select count(*) from public.support_tickets where status in ('pending','reviewing')),'wallet_total',(select coalesce(sum(amount),0) from public.account_wallet_ledger),'deposits_total',(select coalesce(sum(amount),0) from public.promotion_deposits),'withdrawals_total',(select coalesce(sum(amount),0) from public.cw_withdraw_requests where status='paid'));
 elsif p_section='users' then
  select count(*) into total from public.profiles p where concat_ws(' ',p.phone,p.public_uid,p.display_name) ilike '%'||coalesce(p_search,'')||'%';
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from(select p.*,(select coalesce(sum(amount),0) from public.account_wallet_ledger where user_id=p.id) as balance from public.profiles p where concat_ws(' ',p.phone,p.public_uid,p.display_name) ilike '%'||coalesce(p_search,'')||'%' order by p.created_at desc limit 50 offset off)x;
 elsif p_section='settings' then perform colorwin_private.require_admin('content');return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x)) from colorwin_private.site_settings x),'[]'::jsonb),'total',3);
 elsif p_section='audit' then perform colorwin_private.require_admin('owner');select count(*) into total from colorwin_private.admin_audit;select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from(select * from colorwin_private.admin_audit order by id desc limit 50 offset off)x;
 elsif p_section='admins' then perform colorwin_private.require_admin('owner');return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x)) from(select a.*,p.phone,p.display_name from colorwin_private.admin_members a join public.profiles p on p.id=a.user_id)x),'[]'::jsonb),'total',(select count(*) from colorwin_private.admin_members));
 elsif p_section='gifts' then perform colorwin_private.require_admin('content');select count(*) into total from colorwin_private.gift_codes;select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from(select * from colorwin_private.gift_codes order by created_at desc limit 50 offset off)x;
 elsif p_section='games' then perform colorwin_private.require_admin('content');return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x)) from colorwin_private.game_controls x),'[]'::jsonb),'total',(select count(*) from colorwin_private.game_controls));
 else
  tbl:=case p_section when 'deposits' then 'cw_deposit_requests' when 'withdrawals' then 'cw_withdraw_requests' when 'support' then 'support_tickets' when 'feedback' then 'account_feedback' when 'ledger' then 'account_wallet_ledger' when 'entries' then 'cw_tournament_entries' when 'tournaments' then 'cw_tournaments' when 'announcements' then 'cw_announcements' when 'promotion' then 'cw_promotion_campaigns' else null end;
  if tbl is null then raise exception 'Unknown section';end if;
  perform colorwin_private.require_admin(case when p_section in ('deposits','withdrawals','ledger') then 'finance' when p_section in ('support','feedback') then 'support' when p_section in ('entries','tournaments') then 'tournaments' else 'content' end);
  if p_section='tournaments' then
   select count(*) into total from public.cw_tournaments tm where tm::text ilike '%'||coalesce(p_search,'')||'%';
   select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from(select tm.*,rm.room_id,rm.password as room_password from public.cw_tournaments tm left join colorwin_private.tournament_rooms rm on rm.tournament_id=tm.id where tm::text ilike '%'||coalesce(p_search,'')||'%' order by tm.created_at desc limit 50 offset off)x;
  elsif p_section in ('announcements','promotion') then
   execute format('select count(*) from public.%I t where t::text ilike $1',tbl) into total using '%'||coalesce(p_search,'')||'%';
   execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from(select * from public.%I t where t::text ilike $1 order by created_at desc limit 50 offset $2)x',tbl) into rows using '%'||coalesce(p_search,'')||'%',off;
  else
   execute format('select count(*) from public.%I t join public.profiles p on p.id=t.user_id where concat_ws('' '',t::text,p.phone,p.public_uid) ilike $1',tbl) into total using '%'||coalesce(p_search,'')||'%';
   execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from(select t.*,p.phone,p.public_uid,p.display_name from public.%I t join public.profiles p on p.id=t.user_id where concat_ws('' '',t::text,p.phone,p.public_uid) ilike $1 order by t.created_at desc limit 50 offset $2)x',tbl) into rows using '%'||coalesce(p_search,'')||'%',off;
  end if;
 end if;return jsonb_build_object('rows',rows,'total',total,'role',r);
end $$;
create function public.colorwin_admin_list(p_section text default 'overview',p_search text default '',p_page integer default 0) returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.admin_list(p_section,p_search,p_page)$$;

create function colorwin_private.admin_action(p_action text,p_data jsonb,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.cw_deposit_requests;w public.cw_withdraw_requests;s public.support_tickets;t public.cw_tournaments;e public.cw_tournament_entries;m public.cw_payout_methods;before_row jsonb;after_row jsonb;target uuid;v text;a numeric;cfg jsonb;max_rewards numeric;begin
 perform colorwin_private.require_admin('read');if coalesce(char_length(btrim(p_reason)),0) not between 3 and 500 then raise exception 'Enter an audit reason (3–500 characters)';end if;
 if p_action in ('approve_deposit','reject_deposit') then
  perform colorwin_private.require_admin('finance');select * into d from public.cw_deposit_requests where id=(p_data->>'id')::uuid for update;if not found then raise exception 'Deposit not found';end if;before_row:=to_jsonb(d);
  if d.status<>'pending' or d.utr is null then raise exception 'Only pending UTR deposits can be reviewed';end if;
  if p_action='approve_deposit' then
   if coalesce(char_length(btrim(p_data->>'bank_reference')),0) not between 3 and 100 then raise exception 'Bank verification reference required';end if;
   insert into public.account_wallet_ledger(user_id,amount,source,reference) values(d.user_id,d.amount,'deposit','deposit:'||d.id);
   insert into public.promotion_deposits(user_id,payment_reference,amount) values(d.user_id,'deposit:'||d.id,d.amount);
  end if;
  update public.cw_deposit_requests set status=case when p_action='approve_deposit' then 'complete' else 'rejected' end,bank_reference=case when p_action='approve_deposit' then btrim(p_data->>'bank_reference') else null end,review_note=p_reason||coalesce(' · bank ref '||(p_data->>'bank_reference'),''),reviewed_by=auth.uid(),reviewed_at=now() where id=d.id returning to_jsonb(cw_deposit_requests.*) into after_row;
  insert into public.account_notifications(user_id,kind,title,message) values(d.user_id,'deposit',case when p_action='approve_deposit' then 'Deposit approved' else 'Deposit rejected' end,'₹'||d.amount||' · '||p_reason);
 elsif p_action in ('process_withdrawal','pay_withdrawal','reject_withdrawal') then
  perform colorwin_private.require_admin('finance');select * into w from public.cw_withdraw_requests where id=(p_data->>'id')::uuid for update;if not found then raise exception 'Withdrawal not found';end if;before_row:=to_jsonb(w);
  if w.status not in ('pending','processing') then raise exception 'Withdrawal already finalized';end if;
  if p_action='process_withdrawal' and w.status<>'pending' then raise exception 'Already processing';end if;
  if p_action='pay_withdrawal' then v:=btrim(p_data->>'payout_reference');if coalesce(char_length(v),0) not between 3 and 100 then raise exception 'Actual payout transaction reference required';end if;
  elsif p_action='reject_withdrawal' then insert into public.account_wallet_ledger(user_id,amount,source,reference) values(w.user_id,w.amount,'withdrawal_refund','withdraw-refund:'||w.id);end if;
  update public.cw_withdraw_requests set status=case p_action when 'pay_withdrawal' then 'paid' when 'reject_withdrawal' then 'rejected' else 'processing' end,payout_reference=v,review_note=p_reason,reviewed_by=auth.uid(),reviewed_at=now() where id=w.id returning to_jsonb(cw_withdraw_requests.*) into after_row;
  insert into public.account_notifications(user_id,kind,title,message) values(w.user_id,'withdrawal','Withdrawal update','₹'||w.amount||' · '||(after_row->>'status')||' · '||p_reason);
 elsif p_action='user_update' then
  perform colorwin_private.require_admin('owner');target:=(p_data->>'id')::uuid;select to_jsonb(p) into before_row from public.profiles p where id=target for update;if before_row is null then raise exception 'User not found';end if;
  if exists(select 1 from colorwin_private.admin_members where user_id=target and active) and coalesce((p_data->>'is_blocked')::boolean,false) then raise exception 'Revoke admin access before suspending an admin';end if;
  if p_data ? 'display_name' and char_length(p_data->>'display_name') not between 2 and 30 then raise exception 'Name must be 2–30 characters';end if;
  update public.profiles set display_name=coalesce(p_data->>'display_name',display_name),is_blocked=coalesce((p_data->>'is_blocked')::boolean,is_blocked) where id=target returning to_jsonb(profiles.*) into after_row;
 elsif p_action='wallet_adjustment' then
  perform colorwin_private.require_admin('owner');target:=(p_data->>'user_id')::uuid;a:=(p_data->>'amount')::numeric;if a is null or a=0 or abs(a)>100000 or a<>round(a,2) then raise exception 'Invalid adjustment';end if;
  perform pg_advisory_xact_lock(hashtextextended(target::text,94));
  if not exists(select 1 from public.profiles where id=target) then raise exception 'User not found';end if;
  if coalesce((select sum(amount) from public.account_wallet_ledger where user_id=target),0)+a<0 then raise exception 'Adjustment would create a negative balance';end if;
  insert into public.account_wallet_ledger(user_id,amount,source,reference) values(target,a,'admin_adjustment','adjustment:'||(p_data->>'request_id')::uuid) returning to_jsonb(account_wallet_ledger.*) into after_row;
  insert into public.account_notifications(user_id,kind,title,message) values(target,'account','Wallet adjustment','₹'||a||' · '||p_reason);
 elsif p_action='support_update' then
  perform colorwin_private.require_admin('support');select * into s from public.support_tickets where id=(p_data->>'id')::uuid for update;if not found then raise exception 'Ticket not found';end if;before_row:=to_jsonb(s);
  if s.status in ('resolved','rejected') then raise exception 'Ticket already finalized';end if;
  if p_data->>'status' not in ('reviewing','resolved','rejected') or coalesce(char_length(p_data->>'reply'),0) not between 3 and 2000 then raise exception 'Reply and valid status required';end if;
  if coalesce((p_data->>'apply_change')::boolean,false) then
   if p_data->>'status'<>'resolved' then raise exception 'Resolve ticket to apply verified change';end if;
   if s.category not in ('ifsc','bank-name','bank-rebind','upi-rebind','usdt-rebind') then raise exception 'This category does not support beneficiary changes';end if;
   select * into m from public.cw_payout_methods where user_id=s.user_id and active and details->>'account'=case when s.category like 'bank%' or s.category='ifsc' then s.details->>'bank_number' when s.category='upi-rebind' then s.details->>'upi' else s.details->>'usdt' end for update;
   if not found then raise exception 'Matching active beneficiary not found; verify ticket account';end if;
   if s.category in ('ifsc','bank-name') then
    if m.kind<>'bank' then raise exception 'Ticket must refer to a bank beneficiary';end if;
    update public.cw_payout_methods set details=details||case when s.category='ifsc' then jsonb_build_object('ifsc',s.details->>'ifsc') else jsonb_build_object('bank',s.details->>'bank_name') end where id=m.id;
   else update public.cw_payout_methods set active=false where id=m.id;end if;
  end if;
  update public.support_tickets set status=p_data->>'status',admin_reply=p_data->>'reply',updated_at=now() where id=s.id returning to_jsonb(support_tickets.*) into after_row;
  insert into public.account_notifications(user_id,kind,title,message) values(s.user_id,'account','Support request updated',s.number||' · '||(p_data->>'reply'));
 elsif p_action='feedback_update' then
  perform colorwin_private.require_admin('support');if p_data->>'status' not in ('reviewed','resolved') then raise exception 'Invalid feedback status';end if;
  select to_jsonb(x) into before_row from public.account_feedback x where id=(p_data->>'id')::uuid for update;update public.account_feedback set status=p_data->>'status' where id=(p_data->>'id')::uuid returning to_jsonb(account_feedback.*) into after_row;if after_row is null then raise exception 'Feedback not found';end if;
 elsif p_action='save_tournament' then
  perform colorwin_private.require_admin('tournaments');target:=nullif(p_data->>'id','')::uuid;
  if p_data->>'status' not in ('draft','open','live','completed','cancelled') then raise exception 'Invalid tournament status';end if;
  if target is not null then select * into t from public.cw_tournaments where id=target for update;if not found then raise exception 'Tournament not found';end if;before_row:=to_jsonb(t);if t.status in ('completed','cancelled') then raise exception 'Finalized tournament cannot be edited';end if;end if;
  if p_data->>'banner' !~ '^assets/tournaments/[a-zA-Z0-9_-]+\.png$' then raise exception 'Select a bundled tournament banner';end if;
  if target is null then
   if p_data->>'status' not in ('draft','open') then raise exception 'Create tournament as draft or open';end if;
   insert into public.cw_tournaments(title,game,mode,status,banner,entry_fee,prize_pool,capacity,starts_at,rules) values(p_data->>'title',p_data->>'game',p_data->>'mode',p_data->>'status',p_data->>'banner',(p_data->>'entry_fee')::numeric,(p_data->>'prize_pool')::numeric,(p_data->>'capacity')::integer,(p_data->>'starts_at')::timestamptz,left(coalesce(p_data->>'rules',''),5000)) returning * into t;
  else
   if exists(select 1 from public.cw_tournament_entries where tournament_id=target) and ((p_data->>'entry_fee')::numeric<>t.entry_fee or p_data->>'game'<>t.game or p_data->>'mode'<>t.mode) then raise exception 'Cannot change fees or game after registrations';end if;
   if (p_data->>'capacity')::integer<(select count(*) from public.cw_tournament_entries where tournament_id=target and status<>'cancelled') then raise exception 'Capacity below registered players';end if;
   if p_data->>'status'='cancelled' then
    -- Refund each registration once. No arbitrary deletion of financial history.
    for e in select * from public.cw_tournament_entries where tournament_id=target and status<>'cancelled' for update loop
     if t.entry_fee>0 then insert into public.account_wallet_ledger(user_id,amount,source,reference) values(e.user_id,t.entry_fee,'tournament_refund','tournament-refund:'||e.id);end if;
     update public.cw_tournament_entries set status='cancelled' where id=e.id;
    end loop;
   end if;
   update public.cw_tournaments set title=p_data->>'title',status=p_data->>'status',banner=p_data->>'banner',entry_fee=(p_data->>'entry_fee')::numeric,prize_pool=(p_data->>'prize_pool')::numeric,capacity=(p_data->>'capacity')::integer,starts_at=(p_data->>'starts_at')::timestamptz,rules=left(coalesce(p_data->>'rules',''),5000) where id=target returning * into t;
  end if;
  if coalesce(p_data->>'room_id','')<>'' then insert into colorwin_private.tournament_rooms values(t.id,left(p_data->>'room_id',100),left(coalesce(p_data->>'room_password',''),100)) on conflict(tournament_id) do update set room_id=excluded.room_id,password=excluded.password;end if;after_row:=to_jsonb(t);
 elsif p_action='tournament_result' then
  perform colorwin_private.require_admin('tournaments');select tournament_id into target from public.cw_tournament_entries where id=(p_data->>'id')::uuid;select * into t from public.cw_tournaments where id=target for update;if not found or t.status not in ('live','completed') then raise exception 'Match must be live or completed';end if;
  select * into e from public.cw_tournament_entries where id=(p_data->>'id')::uuid for update;if e.status='cancelled' or e.reward_paid_at is not null then raise exception 'Entry cancelled or reward already finalized';end if;before_row:=to_jsonb(e);a:=(p_data->>'reward')::numeric;
  if a is null or a<0 or a<>round(a,2) or (p_data->>'rank')::integer<=0 then raise exception 'Invalid rank or reward';end if;
  select coalesce(sum(reward),0) into max_rewards from public.cw_tournament_entries where tournament_id=target and reward_paid_at is not null;if max_rewards+a>t.prize_pool then raise exception 'Rewards exceed tournament prize pool';end if;
  if a>0 then insert into public.account_wallet_ledger(user_id,amount,source,reference) values(e.user_id,a,'tournament_reward','tournament-reward:'||e.id);end if;
  update public.cw_tournament_entries set status='played',rank=(p_data->>'rank')::integer,reward=a,reward_paid_at=now() where id=e.id returning to_jsonb(cw_tournament_entries.*) into after_row;
  insert into public.account_notifications(user_id,kind,title,message) values(e.user_id,'account','Tournament result',t.title||' · rank '||(p_data->>'rank')||' · reward ₹'||a);
 elsif p_action='save_settings' then
  perform colorwin_private.require_admin('content');v:=p_data->>'key';cfg:=p_data->'value';if v not in ('payments','promotion','site') or jsonb_typeof(cfg)<>'object' then raise exception 'Invalid settings';end if;
  if v='payments' then
   perform colorwin_private.require_admin('owner');if jsonb_typeof(cfg->'upiIds')<>'array' or jsonb_array_length(cfg->'upiIds') not between 1 and 30 or char_length(cfg->>'receiverName') not between 2 and 100 or (cfg->>'minDeposit')::numeric<1 or (cfg->>'maxDeposit')::numeric<(cfg->>'minDeposit')::numeric or (cfg->>'minWithdraw')::numeric<1 or (cfg->>'maxWithdraw')::numeric<(cfg->>'minWithdraw')::numeric then raise exception 'Invalid payment limits';end if;
   if exists(select 1 from jsonb_array_elements_text(cfg->'upiIds') x where x !~ '^[A-Za-z0-9._-]+@[A-Za-z][A-Za-z0-9.-]+$') then raise exception 'Invalid UPI receiver';end if;
  end if;
  select value into before_row from colorwin_private.site_settings where key=v;update colorwin_private.site_settings set value=cfg,updated_at=now() where key=v;after_row:=cfg;
 elsif p_action='announcement' then
  perform colorwin_private.require_admin('content');target:=nullif(p_data->>'id','')::uuid;
  if target is null then insert into public.cw_announcements(title,message,active) values(p_data->>'title',p_data->>'message',coalesce((p_data->>'active')::boolean,true)) returning to_jsonb(cw_announcements.*) into after_row;
  else select to_jsonb(x) into before_row from public.cw_announcements x where id=target for update;update public.cw_announcements set title=p_data->>'title',message=p_data->>'message',active=(p_data->>'active')::boolean where id=target returning to_jsonb(cw_announcements.*) into after_row;end if;
 elsif p_action='campaign' then
  perform colorwin_private.require_admin('content');target:=nullif(p_data->>'id','')::uuid;
  if coalesce(p_data->>'banner','')<>'' and p_data->>'banner' !~ '^assets/[A-Za-z0-9/_% .-]+\.(png|jpg|webp)$' then raise exception 'Use a local banner path';end if;
  if target is null then insert into public.cw_promotion_campaigns(title,description,banner,active) values(p_data->>'title',left(coalesce(p_data->>'description',''),5000),coalesce(p_data->>'banner',''),(p_data->>'active')::boolean) returning to_jsonb(cw_promotion_campaigns.*) into after_row;
  else select to_jsonb(x) into before_row from public.cw_promotion_campaigns x where id=target for update;update public.cw_promotion_campaigns set title=p_data->>'title',description=left(coalesce(p_data->>'description',''),5000),banner=coalesce(p_data->>'banner',''),active=(p_data->>'active')::boolean where id=target returning to_jsonb(cw_promotion_campaigns.*) into after_row;end if;
 elsif p_action='gift_create' then
  perform colorwin_private.require_admin('content');v:=upper(replace(gen_random_uuid()::text,'-',''));insert into colorwin_private.gift_codes(code,kind,amount,minimum_deposit,max_claims,expires_at) values(v,p_data->>'kind',(p_data->>'amount')::numeric,coalesce((p_data->>'minimum_deposit')::numeric,0),(p_data->>'max_claims')::integer,(p_data->>'expires_at')::timestamptz) returning to_jsonb(gift_codes.*) into after_row;
 elsif p_action='game_control' then
  perform colorwin_private.require_admin('content');v:=p_data->>'game_id';if v is null or v !~ '^[a-zA-Z0-9_-]{1,100}$' then raise exception 'Invalid game id';end if;select to_jsonb(x) into before_row from colorwin_private.game_controls x where game_id=v;insert into colorwin_private.game_controls values(v,(p_data->>'enabled')::boolean,now()) on conflict(game_id) do update set enabled=excluded.enabled,updated_at=now() returning to_jsonb(game_controls.*) into after_row;
 elsif p_action='admin_access' then
  perform colorwin_private.require_admin('owner');target:=(p_data->>'user_id')::uuid;
  perform pg_advisory_xact_lock(6243981);
  if target=auth.uid() then raise exception 'Cannot change your own admin access';end if;
  select to_jsonb(x) into before_row from colorwin_private.admin_members x where user_id=target;
  insert into colorwin_private.admin_members(user_id,role,active) values(target,p_data->>'role',(p_data->>'active')::boolean) on conflict(user_id) do update set role=excluded.role,active=excluded.active returning to_jsonb(admin_members.*) into after_row;
 else raise exception 'Unknown admin action';end if;
 if after_row is null then raise exception 'Action did not update a record';end if;
 perform colorwin_private.log_admin(p_action,coalesce(p_data->>'id',p_data->>'user_id',p_data->>'key',after_row->>'id'),before_row,after_row,p_reason);return after_row;
end $$;
create function public.colorwin_admin_action(p_action text,p_data jsonb,p_reason text) returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.admin_action(p_action,p_data,p_reason)$$;

create function colorwin_private.tournament_action(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=colorwin_private.assert_active();t public.cw_tournaments;e public.cw_tournament_entries;bal numeric;begin
 if p_action='load' then return jsonb_build_object('tournaments',coalesce((select jsonb_agg(to_jsonb(x) order by starts_at) from public.cw_tournaments x where status<>'draft'),'[]'::jsonb),'entries',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from(select en.*,tm.title,tm.game,tm.mode,tm.starts_at from public.cw_tournament_entries en join public.cw_tournaments tm on tm.id=en.tournament_id where en.user_id=u order by en.created_at desc limit 200)x),'[]'::jsonb));
 elsif p_action='join' then
  if not coalesce((select (value->>'tournamentsEnabled')::boolean from colorwin_private.site_settings where key='site'),false) then raise exception 'Tournament registrations temporarily disabled';end if;
  select * into t from public.cw_tournaments where id=(p_data->>'id')::uuid for update;if not found or t.status<>'open' or t.starts_at<=now() then raise exception 'Registration closed';end if;
  if t.game='pubg' then raise exception 'PUBG coming soon';end if;
  if (select count(*) from public.cw_tournament_entries where tournament_id=t.id and status<>'cancelled')>=t.capacity then raise exception 'Tournament full';end if;
  if coalesce(p_data->>'player_id','') !~ '^[0-9]{5,20}$' or coalesce(char_length(p_data->>'player_name'),0) not between 2 and 40 then raise exception 'Enter valid game UID and player name';end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,94));select coalesce(sum(amount),0) into bal from public.account_wallet_ledger where user_id=u;if bal<t.entry_fee then raise exception 'Insufficient wallet balance';end if;
  insert into public.cw_tournament_entries(tournament_id,user_id,player_id,player_name) values(t.id,u,p_data->>'player_id',p_data->>'player_name') returning * into e;
  if t.entry_fee>0 then insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,-t.entry_fee,'tournament_entry','tournament-entry:'||e.id);end if;return to_jsonb(e);
 elsif p_action='room' then
  if not exists(select 1 from public.cw_tournament_entries en join public.cw_tournaments tm on tm.id=en.tournament_id where en.user_id=u and en.tournament_id=(p_data->>'id')::uuid and en.status<>'cancelled' and tm.status='live') then raise exception 'Room only available to registered players during a live match';end if;
  return coalesce((select jsonb_build_object('room_id',room_id,'password',password) from colorwin_private.tournament_rooms where tournament_id=(p_data->>'id')::uuid),'{}'::jsonb);
 end if;raise exception 'Unknown tournament action';end $$;
create function public.colorwin_tournament(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.tournament_action(p_action,p_data)$$;
create function public.colorwin_site_config() returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform colorwin_private.assert_active();return jsonb_build_object('settings',coalesce((select jsonb_object_agg(key,value) from colorwin_private.site_settings),'{}'::jsonb),'announcements',coalesce((select jsonb_agg(to_jsonb(x)) from public.cw_announcements x where active),'[]'::jsonb),'campaigns',coalesce((select jsonb_agg(to_jsonb(x)) from public.cw_promotion_campaigns x where active),'[]'::jsonb),'games',coalesce((select jsonb_object_agg(game_id,enabled) from colorwin_private.game_controls),'{}'::jsonb));end $$;
-- Public wrappers use invoker rights; each private implementation explicitly authorizes callers.
grant usage on schema colorwin_private to authenticated;
revoke all on function colorwin_private.assert_active(),colorwin_private.require_admin(text),colorwin_private.log_admin(text,text,jsonb,jsonb,text),colorwin_private.wallet_action(text,jsonb),colorwin_private.admin_list(text,text,integer),colorwin_private.admin_action(text,jsonb,text),colorwin_private.tournament_action(text,jsonb) from public,anon,authenticated;
grant execute on function colorwin_private.wallet_action(text,jsonb),colorwin_private.admin_list(text,text,integer),colorwin_private.admin_action(text,jsonb,text),colorwin_private.tournament_action(text,jsonb) to authenticated;
revoke all on function public.colorwin_wallet(text,jsonb),public.colorwin_admin_list(text,text,integer),public.colorwin_admin_action(text,jsonb,text),public.colorwin_tournament(text,jsonb),public.colorwin_site_config() from public,anon;
grant execute on function public.colorwin_wallet(text,jsonb),public.colorwin_admin_list(text,text,integer),public.colorwin_admin_action(text,jsonb,text),public.colorwin_tournament(text,jsonb),public.colorwin_site_config() to authenticated;
create policy support_admin_file_read on storage.objects for select to authenticated using(bucket_id='cw_support_files' and exists(select 1 from colorwin_private.admin_members a where a.user_id=(select auth.uid()) and a.active and a.role in ('owner','support')));
-- Storage policy must not expose the membership table. Use an authorized helper instead.
drop policy support_admin_file_read on storage.objects;
create function colorwin_private.support_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from colorwin_private.admin_members a join public.profiles p on p.id=a.user_id where a.user_id=auth.uid() and a.active and not p.is_blocked and a.role in ('owner','support'))$$;
revoke all on function colorwin_private.support_admin() from public,anon;grant execute on function colorwin_private.support_admin() to authenticated;
create policy support_admin_file_read on storage.objects for select to authenticated using(bucket_id='cw_support_files' and (select colorwin_private.support_admin()));
commit;
