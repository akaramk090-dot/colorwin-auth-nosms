begin;
do $$declare u uuid;data jsonb;i integer;amounts numeric[]:=array[300,500,1000,2000,5000];rewards numeric[]:=array[28,58,88,108,288];begin
 for i in 1..6 loop
  u:=gen_random_uuid();
  insert into auth.users(id,email,raw_user_meta_data) values(u,u::text||'@invalid.test',jsonb_build_object('phone','99199988730'||i));
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  if public.colorwin_first_deposit_status()->>'status'<>'awaiting_first_deposit' then raise exception 'New account eligibility incorrect';end if;
  begin perform public.colorwin_claim_first_deposit();raise exception 'Claim before approval accepted';exception when invalid_parameter_value then null;end;
  execute 'reset role';
  insert into public.promotion_deposits(user_id,payment_reference,amount,completed_at)
  values(u,'fixture-first:'||u,case when i=6 then 150 else amounts[i] end,now()-interval '1 day');
  -- A later matching deposit must not rescue a nonmatching first deposit or change the selected tier.
  insert into public.promotion_deposits(user_id,payment_reference,amount,completed_at) values(u,'fixture-second:'||u,5000,now());
  execute 'set local role authenticated';data:=public.colorwin_first_deposit_status();
  if i<6 and ((data->>'reward')::numeric<>rewards[i] or data->>'status'<>'matched') then raise exception 'Exact tier % failed',i;end if;
  if i=6 and (data->>'status'<>'not_eligible' or (data->>'reward')::numeric<>0 or (data->>'first_amount')::numeric<>150) then raise exception 'Later deposit rescued invalid first amount';end if;
  if i<6 then
   data:=public.colorwin_claim_first_deposit();if data->>'status'<>'claimed' then raise exception 'Manual claim failed';end if;
   perform public.colorwin_claim_first_deposit();
  else
   begin perform public.colorwin_claim_first_deposit();raise exception 'Nonmatching claim accepted';exception when invalid_parameter_value then null;end;
  end if;
  execute 'reset role';
  if i<6 and (select sum(amount) from public.account_wallet_ledger where user_id=u and source='welcome_bonus')<>rewards[i] then raise exception 'Duplicate/wrong bonus credit';end if;
  if i=6 and exists(select 1 from public.account_wallet_ledger where user_id=u and source='welcome_bonus') then raise exception 'Invalid user credited';end if;
 end loop;
 perform set_config('request.jwt.claims','{"role":"authenticated"}',true);execute 'set local role authenticated';
 begin perform public.colorwin_first_deposit_status();raise exception 'Unauthenticated allowed';exception when insufficient_privilege then null;end;
  begin perform public.colorwin_claim_first_deposit();raise exception 'Unauthenticated claim allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';
end $$;
select 'First deposit: exact five tiers, earliest approved deposit only, no later-deposit rescue, account isolation and authentication passed' as result;
rollback;
