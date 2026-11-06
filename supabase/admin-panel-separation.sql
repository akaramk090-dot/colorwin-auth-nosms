begin;

alter table colorwin_private.admin_token_config
 add column if not exists token_hash_scheme text not null default 'bcrypt';
alter table colorwin_private.admin_token_config drop constraint if exists admin_token_config_hash_scheme_check;
alter table colorwin_private.admin_token_config
 add constraint admin_token_config_hash_scheme_check check(token_hash_scheme in ('bcrypt','sha256-bcrypt'));

alter table colorwin_private.admin_key_sessions
 add column if not exists panel_scope text not null default 'superadmin',
 add column if not exists panel_version bigint not null default 1;

create table if not exists colorwin_private.admin_panel_keys (
 panel_scope text primary key check(panel_scope in ('finance','gifts_users','ff','support')),
 token_hash text not null,
 version bigint not null default 1,
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table colorwin_private.admin_panel_keys drop constraint if exists admin_panel_keys_panel_scope_check;
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
 add constraint admin_panel_keys_panel_scope_check check(panel_scope in ('finance','gifts_users','ff','support','gifts','users','tournaments','rewards','announcements'));
alter table colorwin_private.admin_panel_keys enable row level security;
revoke all on colorwin_private.admin_panel_keys from public,anon,authenticated;

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

create or replace function colorwin_private.admin_key_gateway(p_operation text,p_session text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 cfg colorwin_private.admin_token_config;
 g colorwin_private.admin_key_sessions;
 panel_key colorwin_private.admin_panel_keys;
 raw_session text;
 h text;
 k text;
 panel text;
 result jsonb;
 attempt colorwin_private.admin_key_attempts;
 owner_id uuid;
 claims_before text;
 context_before text;
 panel_before text;
begin
 if p_operation='panel_status' then
  panel:=coalesce(p_data->>'panel','superadmin');
  if panel not in ('superadmin','finance','gifts_users','ff','support') then
   return jsonb_build_object('ok',false,'error','Unknown admin panel');
  end if;
  if panel='superadmin' then
   return jsonb_build_object('ok',true,'panel',panel,'configured',exists(select 1 from colorwin_private.admin_token_config where singleton and token_hash is not null));
  end if;
  return jsonb_build_object('ok',true,'panel',panel,'configured',exists(select 1 from colorwin_private.admin_panel_keys where panel_scope=panel));
 end if;

 if p_operation='unlock' then
  insert into colorwin_private.admin_key_attempts(bucket) values('unlock') on conflict do nothing;
  select * into attempt from colorwin_private.admin_key_attempts where bucket='unlock' for update;
  if attempt.window_start<=now()-interval '1 minute' then
   update colorwin_private.admin_key_attempts set attempts=0,window_start=now() where bucket='unlock';
   attempt.attempts:=0;
  end if;
  if attempt.attempts>=20 then
   return jsonb_build_object('ok',false,'error','Too many access attempts. Try again in one minute');
  end if;
  update colorwin_private.admin_key_attempts set attempts=attempts+1 where bucket='unlock';
  panel:=coalesce(p_data->>'panel','superadmin');
  if panel not in ('superadmin','finance','gifts_users','ff','support') then
   return jsonb_build_object('ok',false,'error','Unknown admin panel');
  end if;
  k:=p_data->>'key';
  if k is null or (panel='superadmin' and (char_length(k) not between 16 and 256 or octet_length(k)>256 or k ~ '[[:cntrl:]]'))
   or (panel<>'superadmin' and k !~ '^[A-Za-z0-9_-]{16,64}$') then
   return jsonb_build_object('ok',false,'error','Incorrect access key');
  end if;
  select * into cfg from colorwin_private.admin_token_config where singleton for share;
  if panel='superadmin' then
   if cfg.token_hash is null or
    (case when cfg.token_hash_scheme='sha256-bcrypt'
     then extensions.crypt(encode(extensions.digest(convert_to(k,'UTF8'),'sha256'),'hex'),cfg.token_hash)
     else extensions.crypt(k,cfg.token_hash)
    end)<>cfg.token_hash then
    return jsonb_build_object('ok',false,'error','Incorrect access key');
   end if;
   owner_id:=cfg.updated_by;
  else
   select * into panel_key from colorwin_private.admin_panel_keys where panel_scope=panel for share;
   if panel_key.panel_scope is null then
    return jsonb_build_object('ok',false,'error','This panel key has not been generated. Open Superadmin → Panel keys to create it.');
   end if;
   if extensions.crypt(k,panel_key.token_hash)<>panel_key.token_hash then
    return jsonb_build_object('ok',false,'error','Incorrect access key');
   end if;
   owner_id:=cfg.updated_by;
  end if;
  if owner_id is null or not exists(
   select 1 from colorwin_private.admin_members m
   join public.profiles p on p.id=m.user_id
   where m.user_id=owner_id and m.role='owner' and m.active and not p.is_blocked
  ) then
   return jsonb_build_object('ok',false,'error','Panel owner access is unavailable');
  end if;
  raw_session:=encode(extensions.gen_random_bytes(32),'hex');
  h:=encode(extensions.digest(raw_session,'sha256'),'hex');
  delete from colorwin_private.admin_key_sessions where expires_at<=now() or version<>cfg.version;
  insert into colorwin_private.admin_key_sessions(session_hash,user_id,version,panel_scope,panel_version)
  values(h,owner_id,cfg.version,panel,case when panel='superadmin' then 1 else panel_key.version end);
  insert into colorwin_private.admin_audit(actor,action,target,after_data,reason)
  values(owner_id,'admin_key_unlock',panel,jsonb_build_object('session',left(h,12)),'Panel unlocked using owner access key');
  return jsonb_build_object('ok',true,'session',raw_session,'role','owner','panel',panel,'user_id',owner_id);
 end if;

 if p_session is null or p_session !~ '^[a-f0-9]{64}$' then
  return jsonb_build_object('ok',false,'error','ADMIN_TOKEN_REQUIRED: Enter your access key');
 end if;
 h:=encode(extensions.digest(p_session,'sha256'),'hex');
 if p_operation='rotate' then
  select * into cfg from colorwin_private.admin_token_config where singleton for update;
 else
  select * into cfg from colorwin_private.admin_token_config where singleton for share;
 end if;
 select * into g from colorwin_private.admin_key_sessions
  where session_hash=h and version=cfg.version and expires_at>now() for update;
 if g.session_hash is null
   or (g.panel_scope<>'superadmin' and not exists(
    select 1 from colorwin_private.admin_panel_keys where panel_scope=g.panel_scope and version=g.panel_version
   ))
   or not exists(
    select 1 from colorwin_private.admin_members m
    join public.profiles p on p.id=m.user_id
    where m.user_id=g.user_id and m.active and m.role='owner' and not p.is_blocked
   ) then
  return jsonb_build_object('ok',false,'error','ADMIN_TOKEN_REQUIRED: Session expired. Enter your access key');
 end if;
 if not colorwin_private.admin_panel_allows(g.panel_scope,p_operation,coalesce(p_data,'{}'::jsonb)) then
  return jsonb_build_object('ok',false,'error','ADMIN_PANEL_FORBIDDEN: This key cannot access that panel action');
 end if;
 if p_operation='lock' then
  delete from colorwin_private.admin_key_sessions where session_hash=h;
  return jsonb_build_object('ok',true);
 end if;
 if p_operation='status' then
  return jsonb_build_object('ok',true,'unlocked',true,'configured',true,'role','owner','panel',g.panel_scope);
 end if;
 if p_operation='keys' then
  select jsonb_agg(jsonb_build_object('panel',p.panel_scope,'label',p.label,'configured',k.panel_scope is not null,'updated_at',k.updated_at) order by p.ordinal)
   into result
   from (values
    ('finance','Finance',1),('gifts_users','Gift Codes & Users',2),
    ('ff','Free Fire Tournaments & Players/Rewards',3),('support','All Support',4)
   ) as p(panel_scope,label,ordinal)
   left join colorwin_private.admin_panel_keys k on k.panel_scope=p.panel_scope;
  return jsonb_build_object('ok',true,'panels',coalesce(result,'[]'::jsonb));
 end if;
 if p_operation='provision' then
  panel:=p_data->>'panel';
  if panel is null or panel not in ('finance','gifts_users','ff','support') then
   return jsonb_build_object('ok',false,'error','Unknown admin panel');
  end if;
  k:=encode(extensions.gen_random_bytes(32),'hex');
  insert into colorwin_private.admin_panel_keys(panel_scope,token_hash,version,updated_by,updated_at)
  values(panel,extensions.crypt(k,extensions.gen_salt('bf',10)),1,g.user_id,now())
  on conflict(panel_scope) do update
   set token_hash=excluded.token_hash,version=colorwin_private.admin_panel_keys.version+1,updated_by=excluded.updated_by,updated_at=excluded.updated_at
  returning * into panel_key;
  delete from colorwin_private.admin_key_sessions where panel_scope=panel;
  insert into colorwin_private.admin_audit(actor,action,target,after_data,reason)
  values(g.user_id,'admin_panel_key_rotate',panel,jsonb_build_object('version',panel_key.version),'Owner generated or rotated a panel key');
  return jsonb_build_object('ok',true,'panel',panel,'key',k,'version',panel_key.version);
 end if;
 if p_operation='rotate' then
  insert into colorwin_private.admin_key_attempts(bucket) values(h) on conflict do nothing;
  select * into attempt from colorwin_private.admin_key_attempts where bucket=h for update;
  if attempt.window_start<=now()-interval '15 minutes' then
   update colorwin_private.admin_key_attempts set attempts=0,window_start=now() where bucket=h;
   attempt.attempts:=0;
  end if;
  if attempt.attempts>=5 then
   return jsonb_build_object('ok',false,'error','Too many incorrect current keys. Try again after 15 minutes');
  end if;
  k:=p_data->>'current';
  if k is null or char_length(k) not between 16 and 256 or octet_length(k)>256 or k ~ '[[:cntrl:]]'
   or (case when cfg.token_hash_scheme='sha256-bcrypt'
    then extensions.crypt(encode(extensions.digest(convert_to(k,'UTF8'),'sha256'),'hex'),cfg.token_hash)
    else extensions.crypt(k,cfg.token_hash)
   end)<>cfg.token_hash then
   update colorwin_private.admin_key_attempts set attempts=attempts+1 where bucket=h;
   return jsonb_build_object('ok',false,'error','Incorrect current access key');
  end if;
  k:=p_data->>'token';
  if k is null or char_length(k) not between 16 and 256 or octet_length(k)>256 or k ~ '[[:cntrl:]]' then
   return jsonb_build_object('ok',false,'error','Use a 16–256 character key without control characters');
  end if;
  if (case when cfg.token_hash_scheme='sha256-bcrypt'
   then extensions.crypt(encode(extensions.digest(convert_to(k,'UTF8'),'sha256'),'hex'),cfg.token_hash)
   else extensions.crypt(k,cfg.token_hash)
  end)=cfg.token_hash then
   return jsonb_build_object('ok',false,'error','New key must differ from the current key');
  end if;
  update colorwin_private.admin_token_config
   set token_hash=extensions.crypt(encode(extensions.digest(convert_to(k,'UTF8'),'sha256'),'hex'),extensions.gen_salt('bf',10)),token_hash_scheme='sha256-bcrypt',version=version+1,updated_at=now(),updated_by=g.user_id
   where singleton returning * into cfg;
  delete from colorwin_private.admin_token_grants;
  delete from colorwin_private.admin_key_sessions where session_hash<>h;
  update colorwin_private.admin_key_sessions set version=cfg.version where session_hash=h;
  delete from colorwin_private.admin_key_attempts where bucket=h;
  insert into colorwin_private.admin_audit(actor,action,target,after_data,reason)
  values(g.user_id,'admin_key_rotate','panel',jsonb_build_object('version',cfg.version,'session',left(h,12)),'Owner changed Superadmin access key');
  return jsonb_build_object('ok',true);
 end if;

 claims_before:=current_setting('request.jwt.claims',true);
 context_before:=current_setting('colorwin.admin_key_session',true);
 panel_before:=current_setting('colorwin.admin_panel_scope',true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',g.user_id,'role','authenticated')::text,true);
 perform set_config('colorwin.admin_key_session',h,true);
 perform set_config('colorwin.admin_panel_scope',g.panel_scope,true);
 if p_operation='list' then
  result:=colorwin_private.admin_list(coalesce(p_data->>'p_section','overview'),coalesce(p_data->>'p_search',''),coalesce((p_data->>'p_page')::integer,0));
 elsif p_operation='action' then
  if coalesce(char_length(btrim(p_data->>'p_reason')),0) not between 3 and 470 then
   raise exception 'Enter an audit reason (3–470 characters)';
  end if;
  result:=colorwin_private.admin_action(p_data->>'p_action',p_data->'p_data','[Key session '||left(h,12)||'] '||(p_data->>'p_reason'));
 elsif p_operation='attachment' then
  perform colorwin_private.require_admin('support');
  if not exists(
   select 1 from public.support_tickets s
   cross join lateral jsonb_array_elements(s.attachments) a
   where a->>'path'=p_data->>'path'
  ) then
   raise exception 'Attachment not found';
  end if;
  result:=jsonb_build_object('path',p_data->>'path');
 else
  raise exception 'Unknown admin operation';
 end if;
 perform set_config('request.jwt.claims',coalesce(claims_before,''),true);
 perform set_config('colorwin.admin_key_session',coalesce(context_before,''),true);
 perform set_config('colorwin.admin_panel_scope',coalesce(panel_before,''),true);
 return result;
end $$;

create or replace function public.colorwin_admin_key_gateway(p_operation text,p_session text default null,p_data jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$
 select colorwin_private.admin_key_gateway(p_operation,p_session,p_data)
$$;

revoke all on function colorwin_private.admin_key_gateway(text,text,jsonb),public.colorwin_admin_key_gateway(text,text,jsonb)
 from public,anon,authenticated;
grant usage on schema colorwin_private to service_role;
grant execute on function colorwin_private.admin_key_gateway(text,text,jsonb),public.colorwin_admin_key_gateway(text,text,jsonb)
 to service_role;

revoke all on function public.colorwin_admin_token(text,text,text),public.colorwin_admin_list(text,text,integer),public.colorwin_admin_action(text,jsonb,text)
 from public,anon,authenticated;
revoke all on function colorwin_private.admin_token_action(text,text,text),colorwin_private.admin_list(text,text,integer),colorwin_private.admin_action(text,jsonb,text)
 from public,anon,authenticated;

commit;
