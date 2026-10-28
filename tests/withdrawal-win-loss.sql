begin;do $$ declare u uuid:=gen_random_uuid();d jsonb;begin
insert into auth.users(id,email,raw_user_meta_data) values(u,u||'@invalid.test','{"phone":"99187111109"}');
insert into public.account_wallet_ledger(user_id,amount,source,reference,created_at) values(u,100,'deposit','need-deposit:'||u,now()-interval '10 minutes');
insert into public.account_game_records(user_id,category,game_name,bet,winnings,created_at) values(u,'video','Mines',1,2,now()-interval '9 minutes');
insert into public.account_wallet_ledger(user_id,amount,source,reference,created_at) values(u,-1,'game_bet','need-bet1:'||u,now()-interval '9 minutes'),(u,2,'game_win','need-win1:'||u,now()-interval '8 minutes');
if colorwin_private.withdrawal_need(u)<>99 then raise exception '1 bet must reduce need by 1 regardless of winnings';end if;
insert into public.account_game_records(user_id,category,game_name,bet,winnings,created_at) values(u,'video','Limbo',50,100,now()-interval '7 minutes');
insert into public.account_wallet_ledger(user_id,amount,source,reference,created_at) values(u,-50,'game_bet','need-bet50:'||u,now()-interval '7 minutes'),(u,100,'game_win','need-win50:'||u,now()-interval '6 minutes');
if colorwin_private.withdrawal_need(u)<>49 then raise exception '50 bet must reduce need by 50 without double counting ledger';end if;
insert into public.account_game_records(user_id,category,game_name,bet,winnings,created_at) values(u,'video','Aviator',49,0,now()-interval '5 minutes');
if colorwin_private.withdrawal_need(u)<>0 then raise exception 'Losing bet must reduce need';end if;
insert into public.account_wallet_ledger(user_id,amount,source,reference,created_at) values(u,500,'game_win','need-bigwin:'||u,now()-interval '4 minutes'),(u,100,'tournament_reward','need-tournamentwin:'||u,now()-interval '3 minutes');
if colorwin_private.withdrawal_need(u)<>0 then raise exception 'Win reintroduced need';end if;
perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
execute 'set local role authenticated';d:=public.colorwin_wallet('load');if (d->>'betting_need')::numeric<>0 then raise exception 'Wallet reports wrong need';end if;execute 'reset role';
insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,20,'deposit','need-newdeposit:'||u);
if colorwin_private.withdrawal_need(u)<>20 then raise exception 'New deposit needs own wagering';end if;
end $$;rollback;
