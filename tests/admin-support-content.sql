begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('c0000000-0000-4000-8000-000000000001','cw-ops-owner@invalid.test','{"phone":"992000000001"}'),
 ('c0000000-0000-4000-8000-000000000002','cw-ops-user@invalid.test','{"phone":"992000000002"}'),
 ('c0000000-0000-4000-8000-000000000003','cw-ops-finance@invalid.test','{"phone":"992000000003"}');
insert into colorwin_private.admin_members(user_id,role) values('c0000000-0000-4000-8000-000000000001','owner'),('c0000000-0000-4000-8000-000000000003','finance');
-- Verified token grants are test fixtures; live token configuration is preserved.
insert into auth.sessions(id,user_id) select id,id from auth.users where id in ('c0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000003');
insert into colorwin_private.admin_token_config(singleton,token_hash,updated_by) values(true,extensions.crypt('FixtureAccess123456',extensions.gen_salt('bf',10)),'c0000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into colorwin_private.admin_token_grants(session_id,user_id,version,expires_at) select m.user_id,m.user_id,c.version,now()+interval '1 hour' from colorwin_private.admin_members m cross join colorwin_private.admin_token_config c where m.user_id in ('c0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000003');
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000002","session_id":"c0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select public.colorwin_wallet('save_method','{"kind":"bank","details":{"name":"Test Recipient","account":"123456789123","ifsc":"HDFC0001234","bank":"Old Bank","phone":"9999999999"}}');
select public.colorwin_support_submit('bank-name','{"bank_number":"123456789123","bank_name":"Verified Bank"}');
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000001","session_id":"c0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$declare section text;data jsonb;begin
 foreach section in array array['overview','users','deposits','withdrawals','ledger','support','feedback','tournaments','entries','promotion','announcements','gifts','games','settings','admins','audit'] loop
  data:=public.colorwin_admin_list(section,'',0);if data is null then raise exception 'FAIL: section unavailable %',section;end if;
 end loop;
end $$;
reset role;
do $$declare ticket uuid;begin
 select id into ticket from public.support_tickets where user_id='c0000000-0000-4000-8000-000000000002';
 perform public.colorwin_admin_action('support_update',jsonb_build_object('id',ticket,'status','resolved','reply','Bank name verified and corrected','apply_change',true),'Verified appeal documentation');
 if (select details->>'bank' from public.cw_payout_methods where user_id='c0000000-0000-4000-8000-000000000002')<>'Verified Bank' then raise exception 'FAIL: bank correction not applied';end if;
 begin perform public.colorwin_admin_action('support_update',jsonb_build_object('id',ticket,'status','resolved','reply','Repeat','apply_change',true),'Repeated support test');raise exception 'FAIL: finalized appeal applied again';exception when raise_exception then if sqlerrm='FAIL: finalized appeal applied again' then raise;end if;end;
 perform public.colorwin_admin_action('announcement','{"title":"Test announcement","message":"Verified announcement test","active":true}','Publish test announcement');
 perform public.colorwin_admin_action('campaign','{"title":"Test campaign","description":"Test promotion terms","banner":"assets/tournaments/master-banner.png","active":true}','Publish test campaign');
 perform public.colorwin_admin_action('save_settings','{"key":"site","value":{"maintenance":false,"supportEnabled":true,"tournamentsEnabled":true}}','Save valid site settings');
 begin perform public.colorwin_admin_action('save_settings','{"key":"payments","value":{"enabled":true,"upiIds":["valid@ybl"],"receiverName":"Color Win"}}','Invalid missing limits test');raise exception 'FAIL: missing limits accepted';exception when raise_exception then if sqlerrm='FAIL: missing limits accepted' then raise;end if;end;
 perform public.colorwin_admin_action('gift_create',jsonb_build_object('kind','cash','amount',100,'max_claims',1,'expires_at',now()+interval '1 day'),'Create test gift');
end $$;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000003","session_id":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$begin
 perform public.colorwin_admin_list('deposits','',0);
 begin perform public.colorwin_admin_list('support','',0);raise exception 'FAIL: finance read support proofs';exception when insufficient_privilege then null;end;
 begin perform public.colorwin_admin_action('user_update','{"id":"c0000000-0000-4000-8000-000000000002","is_blocked":true}','Finance cannot suspend');raise exception 'FAIL: finance changed users';exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.profiles set is_blocked=true where id='c0000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000002","session_id":"c0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$begin
 begin perform public.colorwin_wallet('load');raise exception 'FAIL: suspended account loaded wallet';exception when insufficient_privilege then null;end;
end $$;
select 'PASS: every admin section, support bank correction once, announcements/campaigns/gifts, settings validation, scoped roles, suspension' as verification;
rollback;
