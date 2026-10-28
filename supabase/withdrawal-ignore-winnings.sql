-- Winning payouts do not create new wagering requirements. Successful bets reduce need once.
CREATE OR REPLACE FUNCTION colorwin_private.withdrawal_need(p_user uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare need numeric:=0;e record;
begin
 for e in
 select delta from (
  select created_at,id,0 kind,amount delta from public.account_wallet_ledger
  where user_id=p_user and amount>0 and source not in ('withdrawal_refund','tournament_refund','game_refund','game_win','tournament_reward')
  union all
  -- Successful paid registrations count once. Cancelled/refunded entries do not count.
  select l.created_at,l.id,1 kind,l.amount delta from public.account_wallet_ledger l
  where l.user_id=p_user and l.source='tournament_entry' and l.amount<0
  and not exists (
   select 1 from public.account_wallet_ledger r where r.user_id=p_user
   and r.source='tournament_refund'
   and r.reference=replace(l.reference,'tournament-entry:','tournament-refund:')
  )
  union all
  select created_at,id,1 kind,-bet delta from public.account_game_records where user_id=p_user and bet>0
 ) events order by created_at,kind,id
 loop need:=greatest(0,need+e.delta);end loop;
 return need;
end $function$

