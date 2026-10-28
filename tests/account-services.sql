-- All synthetic users and financial fixtures are rolled back.
begin;
insert into auth.users(id,aud,role,email,raw_user_meta_data) values
 ('00000000-0000-4000-a000-000000000091','authenticated','authenticated','account-test-91@example.invalid','{}'),
 ('00000000-0000-4000-a000-000000000092','authenticated','authenticated','account-test-92@example.invalid','{}');
select set_config('cw.test.code',public.colorwin_create_gift(12.50,1,now()+interval '1 hour'),true);
select set_config('cw.test.coupon',public.colorwin_create_gift(20,10,now()+interval '1 hour','coupon',100),true);
insert into public.account_wallet_ledger(user_id,amount,source,reference) values('00000000-0000-4000-a000-000000000092',90,'test','rollback-test-92');
insert into public.account_game_records(user_id,category,game_name,bet,winnings) values('00000000-0000-4000-a000-000000000091','lottery','Test',10,15);
insert into public.promotion_deposits(user_id,payment_reference,amount) values('00000000-0000-4000-a000-000000000091','rollback-test-91',100);
select set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000000091',true);
set local role authenticated;
do $$ declare d jsonb; begin
 perform public.colorwin_redeem_gift(current_setting('cw.test.code'));
 d:=public.colorwin_account_data();
 if (d->>'balance')::numeric<>12.50 then raise exception 'Gift did not credit wallet exactly once'; end if;
 if jsonb_array_length(d->'notifications')<>1 then raise exception 'Deposit notification missing'; end if;
 if exists(select 1 from public.account_wallet_ledger where user_id<>'00000000-0000-4000-a000-000000000091') then raise exception 'RLS exposed another account'; end if;
 begin perform public.colorwin_redeem_gift(current_setting('cw.test.code'));raise exception 'Duplicate claim accepted';
 exception when others then if sqlerrm not like '%already claimed%' then raise;end if;end;
 perform public.colorwin_redeem_gift(current_setting('cw.test.coupon'));
 if (public.colorwin_account_data()->>'balance')::numeric<>12.50 then raise exception 'Coupon incorrectly credited cash';end if;
 perform public.colorwin_set_nickname('Account Test');
 if not exists(select 1 from public.profiles where display_name='Account Test') then raise exception 'Nickname not updated';end if;
 perform public.colorwin_submit_feedback('A useful test message for administrator review.');
 if not exists(select 1 from public.account_feedback where status='pending') then raise exception 'Feedback not queued';end if;
 begin perform public.colorwin_submit_feedback('A repeated test message for administrator review.');raise exception 'Cooldown failed';
 exception when others then if sqlerrm not like '%wait a minute%' then raise;end if;end;
 if (public.colorwin_game_statistics('today')->0->>'bet')::numeric<>10 then raise exception 'Statistics total wrong';end if;
 if has_function_privilege('authenticated','public.colorwin_create_gift(numeric,integer,timestamptz,text,numeric)','EXECUTE') then raise exception 'Client can generate gifts';end if;
end $$;
reset role;
rollback;
select 'PASS: cash/coupon claims, duplicate rejection, wallet isolation, feedback cooldown, nickname and statistics; fixtures rolled back' as account_services;
