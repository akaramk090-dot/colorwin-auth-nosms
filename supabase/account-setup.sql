-- Account services. Apply as postgres after schema.sql and promotion-setup.sql.
begin;
create table if not exists colorwin_private.gift_codes (
 code text primary key, kind text not null check(kind in ('cash','coupon')),
 amount numeric(14,2) not null check(amount>0 and amount<=100000),
 minimum_deposit numeric(14,2) not null default 0 check(minimum_deposit>=0),
 max_claims integer not null check(max_claims between 1 and 100000),
 claims integer not null default 0 check(claims>=0),
 expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table if not exists public.account_gift_claims (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 code text not null references colorwin_private.gift_codes(code), kind text not null,
 amount numeric(14,2) not null check(amount>0), minimum_deposit numeric(14,2) not null default 0,
 expires_at timestamptz not null, used_at timestamptz, created_at timestamptz not null default now(), unique(user_id,code)
);
create index if not exists account_gift_claims_user on public.account_gift_claims(user_id,created_at desc);
create table if not exists public.account_wallet_ledger (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 amount numeric(14,2) not null check(amount<>0), source text not null, reference text not null unique,
 created_at timestamptz not null default now()
);
create index if not exists account_wallet_ledger_user on public.account_wallet_ledger(user_id,created_at desc);
create table if not exists public.account_notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('withdrawal','deposit','account')), title text not null,
 message text not null, created_at timestamptz not null default now()
);
create index if not exists account_notifications_user on public.account_notifications(user_id,created_at desc);
create table if not exists public.account_feedback (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 message text not null check(char_length(message) between 10 and 2000),
 status text not null default 'pending' check(status in ('pending','reviewed','resolved')), created_at timestamptz not null default now()
);
create index if not exists account_feedback_user on public.account_feedback(user_id,created_at desc);
create table if not exists public.account_game_records (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 category text not null check(category in ('lottery','video','slot','fish','sport','chess')),
 game_name text not null, bet numeric(14,2) not null check(bet>=0), winnings numeric(14,2) not null default 0 check(winnings>=0),
 created_at timestamptz not null default now()
);
create index if not exists account_game_records_user on public.account_game_records(user_id,created_at desc);
alter table colorwin_private.gift_codes enable row level security;
revoke all on colorwin_private.gift_codes from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['account_gift_claims','account_wallet_ledger','account_notifications','account_feedback','account_game_records'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('drop policy if exists account_own_rows on public.%I',t);
 execute format('create policy account_own_rows on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
 end loop;
end $$;

create or replace function public.colorwin_account_data()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); result jsonb;
begin
 if u is null then raise exception 'Sign in to continue'; end if;
 select jsonb_build_object(
  'balance',coalesce((select sum(amount) from public.account_wallet_ledger where user_id=u),0),
  'gifts',coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at desc) from (select id,kind,amount,minimum_deposit,expires_at,used_at,created_at from public.account_gift_claims where user_id=u order by created_at desc limit 100) g),'[]'::jsonb),
  'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from (
    select id::text,kind,title,message,created_at from public.account_notifications where user_id=u
    union all select 'login','account','Last login','You signed in to your Color Win account.',last_login_at from public.profiles where id=u and last_login_at is not null
    union all select id::text,'deposit','Deposit received','Your deposit of ₹'||amount::text||' has arrived.',completed_at from public.promotion_deposits where user_id=u
  ) n),'[]'::jsonb),
  'games',coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at desc) from (select id,category,game_name,bet,winnings,created_at from public.account_game_records where user_id=u order by created_at desc limit 1000) g),'[]'::jsonb)
 ) into result;
 return result;
end $$;
create or replace function public.colorwin_set_nickname(p_name text)
returns text language plpgsql security definer set search_path='' as $$
declare n text:=btrim(p_name); u uuid:=auth.uid();
begin
 if u is null then raise exception 'Sign in to continue'; end if;
 if char_length(n) not between 2 and 30 then raise exception 'Nickname must be 2–30 characters'; end if;
 update public.profiles set display_name=n where id=u;
 if not found then raise exception 'Account profile unavailable'; end if;
 return n;
end $$;
create or replace function public.colorwin_submit_feedback(p_message text)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); feedback_id uuid;
begin
 if u is null then raise exception 'Sign in to continue'; end if;
 if char_length(btrim(p_message)) not between 10 and 2000 then raise exception 'Feedback must be 10–2000 characters'; end if;
 -- Serialize submissions per account to enforce a one-minute cooldown.
 perform pg_advisory_xact_lock(hashtextextended(u::text,47));
 if exists(select 1 from public.account_feedback where user_id=u and created_at>now()-interval '1 minute') then raise exception 'Please wait a minute before sending more feedback'; end if;
 insert into public.account_feedback(user_id,message) values(u,btrim(p_message)) returning id into feedback_id;
 return feedback_id;
end $$;
create or replace function public.colorwin_redeem_gift(p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); gift colorwin_private.gift_codes; claim_id uuid;
begin
 if u is null then raise exception 'Sign in to continue'; end if;
 if p_code is null or upper(btrim(p_code)) !~ '^[A-F0-9]{32}$' then raise exception 'Invalid gift code'; end if;
 select * into gift from colorwin_private.gift_codes where code=upper(btrim(p_code)) for update;
 if not found then raise exception 'Invalid gift code'; end if;
 if gift.expires_at<=now() then raise exception 'This gift code has expired'; end if;
 if exists(select 1 from public.account_gift_claims where user_id=u and code=gift.code) then raise exception 'You have already claimed this gift'; end if;
 if gift.claims>=gift.max_claims then raise exception 'This gift code has been fully claimed'; end if;
 insert into public.account_gift_claims(user_id,code,kind,amount,minimum_deposit,expires_at)
 values(u,gift.code,gift.kind,gift.amount,gift.minimum_deposit,gift.expires_at) returning id into claim_id;
 if gift.kind='cash' then
  insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,gift.amount,'gift',claim_id::text);
 end if;
 update colorwin_private.gift_codes set claims=claims+1 where code=gift.code;
 return jsonb_build_object('id',claim_id,'kind',gift.kind,'amount',gift.amount);
end $$;
-- Admin/server-only code generation. No browser can choose a gift's value.
create or replace function public.colorwin_create_gift(p_amount numeric,p_max_claims integer default 1,p_expires_at timestamptz default now()+interval '7 days',p_kind text default 'cash',p_minimum_deposit numeric default 0)
returns text language plpgsql security definer set search_path='' as $$
declare new_code text:=upper(replace(gen_random_uuid()::text,'-',''));
begin
 if p_expires_at<=now() then raise exception 'Expiry must be in the future'; end if;
 insert into colorwin_private.gift_codes(code,kind,amount,max_claims,expires_at,minimum_deposit) values(new_code,p_kind,p_amount,p_max_claims,p_expires_at,p_minimum_deposit);
 return new_code;
end $$;
revoke all on function public.colorwin_account_data(),public.colorwin_set_nickname(text),public.colorwin_submit_feedback(text),public.colorwin_redeem_gift(text) from public,anon;
grant execute on function public.colorwin_account_data(),public.colorwin_set_nickname(text),public.colorwin_submit_feedback(text),public.colorwin_redeem_gift(text) to authenticated;
revoke all on function public.colorwin_create_gift(numeric,integer,timestamptz,text,numeric) from public,anon,authenticated;
grant execute on function public.colorwin_create_gift(numeric,integer,timestamptz,text,numeric) to service_role;
create or replace function public.colorwin_game_statistics(p_period text default 'today')
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); day_start timestamp:=date_trunc('day',now() at time zone 'Asia/Kolkata'); from_time timestamptz; to_time timestamptz:=now(); result jsonb;
begin
 if u is null then raise exception 'Sign in to continue'; end if;
 case p_period
 when 'today' then from_time:=day_start at time zone 'Asia/Kolkata';
 when 'yesterday' then from_time:=(day_start-interval '1 day') at time zone 'Asia/Kolkata';to_time:=day_start at time zone 'Asia/Kolkata';
 when 'week' then from_time:=date_trunc('week',day_start) at time zone 'Asia/Kolkata';
 when 'month' then from_time:=date_trunc('month',day_start) at time zone 'Asia/Kolkata';
 else raise exception 'Unknown statistics period'; end case;
 select coalesce(jsonb_agg(to_jsonb(g)),'[]'::jsonb) into result from (
 select category,sum(bet) bet,count(*) count,sum(winnings) winnings from public.account_game_records
 where user_id=u and created_at>=from_time and created_at<to_time group by category) g;
 return result;
end $$;
revoke all on function public.colorwin_game_statistics(text) from public,anon;
grant execute on function public.colorwin_game_statistics(text) to authenticated;
commit;
