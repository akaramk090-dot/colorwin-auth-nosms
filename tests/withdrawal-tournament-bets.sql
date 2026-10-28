begin;
do $$ declare u uuid:=gen_random_uuid();entry uuid:=gen_random_uuid();need numeric;
begin
 insert into auth.users(id,email,raw_user_meta_data) values(u,u::text||'@invalid.test','{"phone":"99188977865"}');
 insert into public.account_wallet_ledger(user_id,amount,source,reference,created_at) values
 (u,558,'deposit','test-deposit:'||u,now()-interval '3 hours'),
 (u,-1,'tournament_entry','tournament-entry:'||entry,now()-interval '2 hours');
 if colorwin_private.withdrawal_need(u)<>557 then raise exception 'One rupee registration not counted';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if (public.colorwin_wallet('load','{}')->>'betting_need')::numeric<>557 then raise exception 'Wallet returned stale requirement';end if;
 execute 'reset role';
 insert into public.account_wallet_ledger(user_id,amount,source,reference,created_at) values(u,1,'tournament_refund','tournament-refund:'||entry,now()-interval '1 hour');
 if colorwin_private.withdrawal_need(u)<>558 then raise exception 'Refunded registration counted as wagering';end if;
 insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,-600,'tournament_entry','tournament-entry:'||gen_random_uuid());
 if colorwin_private.withdrawal_need(u)<>0 then raise exception 'Completed tournament turnover did not reach zero';end if;
 insert into public.account_wallet_ledger(user_id,amount,source,reference,created_at) values(u,100,'deposit','test-next:'||u,now()+interval '1 second');
 if colorwin_private.withdrawal_need(u)<>100 then raise exception 'Past registration covered new deposit';end if;
end $$;
rollback;
