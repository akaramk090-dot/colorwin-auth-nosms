begin;

alter table colorwin_private.admin_panel_keys
 drop constraint if exists admin_panel_keys_panel_scope_check;

insert into colorwin_private.admin_panel_keys(panel_scope,token_hash,version,updated_by,updated_at)
 select 'ff',token_hash,version,updated_by,updated_at
 from colorwin_private.admin_panel_keys
 where panel_scope in ('ff','tournaments','rewards')
 order by case panel_scope when 'ff' then 0 when 'tournaments' then 1 else 2 end
 limit 1
 on conflict(panel_scope) do nothing;

insert into colorwin_private.admin_panel_keys(panel_scope,token_hash,version,updated_by,updated_at)
 select 'gifts_users',token_hash,version,updated_by,updated_at
 from colorwin_private.admin_panel_keys
 where panel_scope in ('gifts_users','gifts','users')
 order by case panel_scope when 'gifts_users' then 0 when 'gifts' then 1 else 2 end
 limit 1
 on conflict(panel_scope) do nothing;

insert into colorwin_private.admin_panel_keys(panel_scope,token_hash,version,updated_by,updated_at)
 select 'support',token_hash,version,updated_by,updated_at
 from colorwin_private.admin_panel_keys
 where panel_scope in ('support','announcements')
 order by case panel_scope when 'support' then 0 else 1 end
 limit 1
 on conflict(panel_scope) do nothing;

update colorwin_private.admin_panel_keys
 set token_hash=extensions.crypt(encode(extensions.gen_random_bytes(32),'hex'),extensions.gen_salt('bf',10)),
     version=version+1,updated_at=now()
 where panel_scope in ('gifts','users','tournaments','rewards','announcements');
update colorwin_private.admin_key_sessions
 set expires_at=least(expires_at,now())
 where panel_scope in ('gifts','users','tournaments','rewards','announcements');

alter table colorwin_private.admin_panel_keys
 add constraint admin_panel_keys_panel_scope_check
 check(panel_scope in ('finance','gifts_users','ff','support','gifts','users','tournaments','rewards','announcements'));

create or replace function colorwin_private.admin_panel_allows(p_panel text,p_operation text,p_data jsonb)
returns boolean language sql immutable set search_path='' as $$
 select case p_operation
  when 'status' then true
  when 'lock' then true
  when 'rotate' then p_panel='superadmin'
  when 'keys' then p_panel='superadmin'
  when 'provision' then p_panel='superadmin' and p_data->>'panel' in ('finance','gifts_users','ff','support')
  when 'list' then
   (p_panel='superadmin' and p_data->>'p_section' in ('overview','settings','games','audit','history'))
   or (p_panel='finance' and p_data->>'p_section' in ('deposits','withdrawals','ledger'))
   or (p_panel='gifts_users' and p_data->>'p_section' in ('gifts','users'))
   or (p_panel='ff' and p_data->>'p_section' in ('tournaments','entries'))
   or (p_panel='support' and p_data->>'p_section' in ('support','feedback','announcements'))
  when 'action' then
   (p_panel='superadmin' and p_data->>'p_action' in ('save_settings','game_control'))
   or (p_panel='finance' and p_data->>'p_action' in ('approve_deposit','reject_deposit','process_withdrawal','pay_withdrawal','reject_withdrawal'))
   or (p_panel='gifts_users' and p_data->>'p_action' in ('gift_create','user_update','wallet_adjustment'))
   or (p_panel='ff' and p_data->>'p_action' in ('save_tournament','delete_tournament','tournament_result','tournament_most_kills','tournament_both_rewards'))
   or (p_panel='support' and p_data->>'p_action' in ('support_update','feedback_update','announcement'))
  when 'attachment' then p_panel='support'
  else false
 end
$$;
revoke all on function colorwin_private.admin_panel_allows(text,text,jsonb) from public,anon,authenticated;

create or replace function colorwin_private.require_admin(p_scope text) returns text
language plpgsql security definer set search_path='' as $$
declare r text;panel text:=nullif(current_setting('colorwin.admin_panel_scope',true),'');
begin
 r:=colorwin_private.require_admin_membership(p_scope);
 perform 1 from colorwin_private.admin_token_config where singleton for share;
 if not colorwin_private.admin_token_unlocked() then
  raise exception 'ADMIN_TOKEN_REQUIRED: Unlock the panel with your access key' using errcode='42501';
 end if;
 if panel is not null and not (
  (panel='superadmin' and p_scope in ('read','owner','content'))
  or (panel='finance' and p_scope in ('read','finance'))
  or (panel='gifts_users' and p_scope in ('read','content','owner'))
  or (panel='ff' and p_scope in ('read','tournaments'))
  or (panel='support' and p_scope in ('read','support','content'))
 ) then
  raise exception 'Admin permission required for this panel' using errcode='42501';
 end if;
 return r;
end $$;

do $migration$
declare
 definition text:=pg_get_functiondef('colorwin_private.admin_key_gateway(text,text,jsonb)'::regprocedure);
 old_panel_guard text:=$old$panel not in ('superadmin','finance','gifts','users','tournaments','rewards','announcements','support') then$old$;
 new_panel_guard text:=$new$panel not in ('superadmin','finance','gifts_users','ff','support') then$new$;
 old_provision_guard text:=$old$panel not in ('finance','gifts','users','tournaments','rewards','announcements','support') then$old$;
 new_provision_guard text:=$new$panel not in ('finance','gifts_users','ff','support') then$new$;
 old_key_list text:=$old$    ('finance','Finance',1),('gifts','Gift Codes',2),('users','Users',3),('tournaments','Tournaments',4),
    ('rewards','Players & Rewards',5),('announcements','Announcements',6),('support','Support & Feedback',7)$old$;
 new_key_list text:=$new$    ('finance','Finance',1),('gifts_users','Gift Codes & Users',2),
    ('ff','Free Fire Tournaments & Players/Rewards',3),('support','All Support',4)$new$;
begin
 if (length(definition)-length(replace(definition,old_panel_guard,'')))/length(old_panel_guard)<>3
  or position(old_provision_guard in definition)=0
  or position(old_key_list in definition)=0 then
  raise exception 'Unexpected live admin gateway definition; no scope changes applied';
 end if;

 definition:=replace(definition,old_panel_guard,new_panel_guard);
 definition:=replace(definition,old_provision_guard,new_provision_guard);
 definition:=replace(definition,old_key_list,new_key_list);
 execute definition;

 if (length(pg_get_functiondef('colorwin_private.admin_key_gateway(text,text,jsonb)'::regprocedure))
    -length(replace(pg_get_functiondef('colorwin_private.admin_key_gateway(text,text,jsonb)'::regprocedure),new_panel_guard,'')))/length(new_panel_guard)<>3
  or position(new_provision_guard in pg_get_functiondef('colorwin_private.admin_key_gateway(text,text,jsonb)'::regprocedure))=0
  or position(new_key_list in pg_get_functiondef('colorwin_private.admin_key_gateway(text,text,jsonb)'::regprocedure))=0 then
  raise exception 'Admin gateway scope verification failed';
 end if;
end
$migration$;

commit;
