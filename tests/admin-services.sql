-- Transactional verification: all fixtures and approvals roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('a0000000-0000-4000-8000-000000000001','cw-admin-test@invalid.test','{"phone":"991000000001"}'),
 ('a0000000-0000-4000-8000-000000000002','cw-user-test@invalid.test','{"phone":"991000000002"}'),
 ('a0000000-0000-4000-8000-000000000003','cw-other-test@invalid.test','{"phone":"991000000003"}');
insert into colorwin_private.admin_members(user_id,role) values('a0000000-0000-4000-8000-000000000001','owner');
-- Verified token grants are test fixtures; live token configuration is preserved.
insert into auth.sessions(id,user_id) select id,id from auth.users where id in ('a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000003');
insert into colorwin_private.admin_token_config(singleton,token_hash,updated_by) values(true,extensions.crypt('FixtureAccess123456',extensions.gen_salt('bf',10)),'a0000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into colorwin_private.admin_token_grants(session_id,user_id,version,expires_at) select m.user_id,m.user_id,c.version,now()+interval '1 hour' from colorwin_private.admin_members m cross join colorwin_private.admin_token_config c where m.user_id in ('a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003');
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002","session_id":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$begin
 begin perform public.colorwin_admin_list();raise exception 'FAIL: regular user entered admin';exception when insufficient_privilege then null;end;
 begin perform public.colorwin_admin_action('wallet_adjustment','{"user_id":"a0000000-0000-4000-8000-000000000002","amount":999,"request_id":"b0000000-0000-4000-8000-000000000001"}','not allowed');raise exception 'FAIL: user credited own wallet';exception when insufficient_privilege then null;end;
 begin perform * from colorwin_private.admin_members;raise exception 'FAIL: membership readable';exception when insufficient_privilege then null;end;
end $$;
reset role;
create temporary table admin_test_ids(key text primary key,id uuid);
do $$declare d jsonb;m jsonb;begin
 d:=public.colorwin_wallet('create_deposit','{"amount":500,"method":"upi","request_id":"b0000000-0000-4000-8000-000000000001"}');insert into admin_test_ids values('deposit',(d->>'id')::uuid);
 perform public.colorwin_wallet('submit_utr',jsonb_build_object('id',d->>'id','utr','991122334455'));
 m:=public.colorwin_wallet('save_method','{"kind":"upi","details":{"name":"Test User","account":"admin-test@ybl","phone":"9999999999"}}');insert into admin_test_ids values('method',(m->>'id')::uuid);
end $$;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","session_id":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$declare d uuid;begin
 select id into d from admin_test_ids where key='deposit';perform public.colorwin_admin_action('approve_deposit',jsonb_build_object('id',d,'bank_reference','verified-test-reference'),'Verified bank amount and UTR');
 begin perform public.colorwin_admin_action('approve_deposit',jsonb_build_object('id',d,'bank_reference','verified-test-reference'),'Duplicate approval test');raise exception 'FAIL: approved twice';exception when raise_exception then if sqlerrm='FAIL: approved twice' then raise;end if;end;
 if (select count(*) from public.account_notifications where user_id='a0000000-0000-4000-8000-000000000002' and kind='deposit' and title='Deposit successful' and message like 'Thank you for your deposit!%')<>1 then raise exception 'FAIL: approval notification missing or duplicated';end if;
 if (select sum(amount) from public.account_wallet_ledger where user_id='a0000000-0000-4000-8000-000000000002')<>500 then raise exception 'FAIL: duplicate wallet credit';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002","session_id":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$declare w jsonb;begin
 w:=public.colorwin_wallet('withdraw',jsonb_build_object('request_id','b0000000-0000-4000-8000-000000000002','amount',200,'method_id',(select id from admin_test_ids where key='method')));insert into admin_test_ids values('withdraw',(w->>'id')::uuid);
 perform public.colorwin_wallet('withdraw',jsonb_build_object('request_id','b0000000-0000-4000-8000-000000000002','amount',200,'method_id',(select id from admin_test_ids where key='method')));
 if (select sum(amount) from public.account_wallet_ledger where user_id='a0000000-0000-4000-8000-000000000002')<>300 then raise exception 'FAIL: withdrawal not reserved';end if;
 begin perform public.colorwin_wallet('withdraw',jsonb_build_object('request_id','b0000000-0000-4000-8000-000000000003','amount',400,'method_id',(select id from admin_test_ids where key='method')));raise exception 'FAIL: overdraft allowed';exception when raise_exception then if sqlerrm='FAIL: overdraft allowed' then raise;end if;end;
end $$;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003","session_id":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$begin if exists(select 1 from public.cw_deposit_requests where user_id='a0000000-0000-4000-8000-000000000002') then raise exception 'FAIL: other users deposits visible';end if;end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","session_id":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$declare w uuid;t jsonb;begin
 select id into w from admin_test_ids where key='withdraw';perform public.colorwin_admin_action('reject_withdrawal',jsonb_build_object('id',w),'Rejected and returned reserved amount');
 begin perform public.colorwin_admin_action('reject_withdrawal',jsonb_build_object('id',w),'Repeated rejection test');raise exception 'FAIL: refund twice';exception when raise_exception then if sqlerrm='FAIL: refund twice' then raise;end if;end;
 if (select sum(amount) from public.account_wallet_ledger where user_id='a0000000-0000-4000-8000-000000000002')<>500 then raise exception 'FAIL: refund not exact';end if;
 t:=public.colorwin_admin_action('save_tournament',jsonb_build_object('title','Transactional test tournament','game','ff','mode','Solo','status','open','banner','assets/tournaments/free-fire-red.png','entry_fee',100,'prize_pool',200,'capacity',2,'starts_at',now()+interval '1 day','rules','Test rules'),'Create test tournament');insert into admin_test_ids values('tournament',(t->>'id')::uuid);
 t:=public.colorwin_admin_action('save_tournament',t||'{"registration_closed":true}'::jsonb,'Close registration fixture');if not (t->>'registration_closed')::boolean then raise exception 'Admin close failed';end if;
 t:=public.colorwin_admin_action('save_tournament',t||'{"registration_closed":false}'::jsonb,'Reopen registration fixture');if (t->>'registration_closed')::boolean then raise exception 'Admin reopen failed';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002","session_id":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$declare e jsonb;begin
 e:=public.colorwin_tournament('join',jsonb_build_object('id',(select id from admin_test_ids where key='tournament'),'player_id','123456789','player_name','Test Player'));insert into admin_test_ids values('entry',(e->>'id')::uuid);
 begin perform public.colorwin_tournament('join',jsonb_build_object('id',(select id from admin_test_ids where key='tournament'),'player_id','123456789','player_name','Test Player'));raise exception 'FAIL: duplicate registration';exception when unique_violation then null;end;
 if (select sum(amount) from public.account_wallet_ledger where user_id='a0000000-0000-4000-8000-000000000002')<>400 then raise exception 'FAIL: duplicate fee';end if;
 begin perform public.colorwin_tournament('room',jsonb_build_object('id',(select id from admin_test_ids where key='tournament')));raise exception 'FAIL: room exposed before live';exception when raise_exception then if sqlerrm='FAIL: room exposed before live' then raise;end if;end;
end $$;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","session_id":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
update public.cw_tournaments set status='live' where id=(select id from admin_test_ids where key='tournament');
do $$declare e uuid;begin
 select id into e from admin_test_ids where key='entry';perform public.colorwin_admin_action('tournament_result',jsonb_build_object('id',e,'rank',1,'reward',200),'Verified winner result');
 begin perform public.colorwin_admin_action('tournament_result',jsonb_build_object('id',e,'rank',1,'reward',200),'Repeated prize test');raise exception 'FAIL: paid reward twice';exception when raise_exception then if sqlerrm='FAIL: paid reward twice' then raise;end if;end;
 if (select sum(amount) from public.account_wallet_ledger where user_id='a0000000-0000-4000-8000-000000000002')<>600 then raise exception 'FAIL: result credit';end if;
 if (select count(*) from colorwin_private.admin_audit where actor='a0000000-0000-4000-8000-000000000001')<>6 then raise exception 'FAIL: missing audit records';end if;
end $$;
select 'PASS: authorization, ownership, UTR approval once, withdrawal reserve/refund, no overdraft, registration once, reward once, audit' as verification;
rollback;
