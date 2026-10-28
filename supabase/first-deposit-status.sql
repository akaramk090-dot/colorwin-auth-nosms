-- Read-only eligibility. Approved deposit records are written by the admin approval transaction.
create or replace function colorwin_private.first_deposit_status()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=colorwin_private.assert_active();first_deposit public.promotion_deposits;reward numeric;
begin
 select * into first_deposit from public.promotion_deposits where user_id=u order by completed_at,id limit 1;
 reward:=case first_deposit.amount when 300 then 28 when 500 then 58 when 1000 then 88 when 2000 then 108 when 5000 then 288 else 0 end;
 return jsonb_build_object('first_amount',first_deposit.amount,'reward',reward,'exact_match',reward>0,
 'status',case when first_deposit.id is null then 'awaiting_first_deposit' when reward>0 then 'matched' else 'not_eligible' end);
end $$;
create or replace function public.colorwin_first_deposit_status()
returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.first_deposit_status()$$;
revoke all on function colorwin_private.first_deposit_status(),public.colorwin_first_deposit_status() from public,anon;
grant execute on function colorwin_private.first_deposit_status(),public.colorwin_first_deposit_status() to authenticated;
notify pgrst,'reload schema';
