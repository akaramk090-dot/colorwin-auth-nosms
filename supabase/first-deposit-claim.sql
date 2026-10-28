create table colorwin_private.first_deposit_claims (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 deposit_id uuid not null unique references public.promotion_deposits(id),
 amount numeric(14,2) not null,
 reward numeric(14,2) not null check(reward in(28,58,88,108,288)),
 claimed_at timestamptz not null default now()
);
alter table colorwin_private.first_deposit_claims enable row level security;
revoke all on colorwin_private.first_deposit_claims from public,anon,authenticated;
create or replace function colorwin_private.first_deposit_status()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=colorwin_private.assert_active();first_deposit public.promotion_deposits;reward numeric;claimed boolean;
begin
 select * into first_deposit from public.promotion_deposits where user_id=u order by completed_at,id limit 1;
 reward:=case first_deposit.amount when 300 then 28 when 500 then 58 when 1000 then 88 when 2000 then 108 when 5000 then 288 else 0 end;
 claimed:=exists(select 1 from colorwin_private.first_deposit_claims where user_id=u);
 return jsonb_build_object('first_amount',first_deposit.amount,'reward',reward,'exact_match',reward>0,'claimed',claimed,
 'status',case when claimed then 'claimed' when first_deposit.id is null then 'awaiting_first_deposit' when reward>0 then 'matched' else 'not_eligible' end);
end $$;
create or replace function colorwin_private.claim_first_deposit()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=colorwin_private.assert_active();first_deposit public.promotion_deposits;reward numeric;
begin
 perform pg_advisory_xact_lock(hashtextextended('first-deposit:'||u::text,0));
 if exists(select 1 from colorwin_private.first_deposit_claims where user_id=u) then return colorwin_private.first_deposit_status();end if;
 select * into first_deposit from public.promotion_deposits where user_id=u order by completed_at,id limit 1;
 reward:=case first_deposit.amount when 300 then 28 when 500 then 58 when 1000 then 88 when 2000 then 108 when 5000 then 288 else 0 end;
 if first_deposit.id is null then raise exception 'Your first deposit must be approved before claiming' using errcode='22023';end if;
 if reward=0 then raise exception 'Your first approved deposit did not exactly match a bonus offer' using errcode='22023';end if;
 insert into colorwin_private.first_deposit_claims(user_id,deposit_id,amount,reward) values(u,first_deposit.id,first_deposit.amount,reward);
 insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,reward,'welcome_bonus','first-deposit-bonus:'||u::text);
 return colorwin_private.first_deposit_status();
end $$;
create or replace function public.colorwin_claim_first_deposit()
returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.claim_first_deposit()$$;
revoke all on function colorwin_private.claim_first_deposit(),public.colorwin_claim_first_deposit() from public,anon;
grant execute on function colorwin_private.claim_first_deposit(),public.colorwin_claim_first_deposit() to authenticated;
notify pgrst,'reload schema';
