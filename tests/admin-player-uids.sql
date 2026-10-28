begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('d2000000-0000-4000-8000-000000000001','cw-uid-owner@invalid.test','{"phone":"995000000001"}'),
 ('d2000000-0000-4000-8000-000000000002','cw-uid-user@invalid.test','{"phone":"995000000002"}');
insert into colorwin_private.admin_members(user_id,role) values('d2000000-0000-4000-8000-000000000001','owner');
insert into auth.sessions(id,user_id) values('d2000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001');
insert into colorwin_private.admin_token_grants(session_id,user_id,version,expires_at) select 'd2000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001',version,now()+interval '1 hour' from colorwin_private.admin_token_config;
update public.profiles set inviter_id='d2000000-0000-4000-8000-000000000001' where id='d2000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims','{"sub":"d2000000-0000-4000-8000-000000000001","session_id":"d2000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$declare result jsonb;owner_uid text;player_uid text;begin
 select public_uid::text into owner_uid from public.profiles where id='d2000000-0000-4000-8000-000000000001';
 select public_uid::text into player_uid from public.profiles where id='d2000000-0000-4000-8000-000000000002';
 result:=public.colorwin_admin_list('users','995000000002',0);
 if result->'rows'->0->>'inviter_uid'<>owner_uid then raise exception 'FAIL: inviter not mapped to UID';end if;
 if result->'id_labels'->>'d2000000-0000-4000-8000-000000000001'<>'UID '||owner_uid then raise exception 'FAIL: player display mapping';end if;
 perform public.colorwin_admin_action('admin_access',jsonb_build_object('public_uid',player_uid,'role','support','active',true),'Admin access changed');
 if not exists(select 1 from colorwin_private.admin_members where user_id='d2000000-0000-4000-8000-000000000002' and role='support' and active) then raise exception 'FAIL: UID assignment';end if;
 result:=public.colorwin_admin_list('admins','',0);
 if not exists(select 1 from jsonb_array_elements(result->'rows') x where x->>'user_id'='d2000000-0000-4000-8000-000000000002' and x->>'public_uid'=player_uid) then raise exception 'FAIL: admin UID absent';end if;
 begin perform public.colorwin_admin_action('admin_access','{"public_uid":"-1","role":"support","active":true}','Invalid UID test');raise exception 'FAIL: invalid UID accepted';exception when raise_exception then if sqlerrm='FAIL: invalid UID accepted' then raise;end if;end;
end $$;
select 'PASS: inviter Color Win UID, UUID display mapping, admin assignment by UID, invalid UID rejection' as verification;
rollback;
