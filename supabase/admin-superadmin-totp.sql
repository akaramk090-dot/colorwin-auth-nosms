begin;

create table if not exists colorwin_private.admin_superadmin_totp (
 singleton boolean primary key default true check(singleton),
 secret_ciphertext text not null,
 secret_nonce text not null,
 enabled boolean not null default false,
 attempts integer not null default 0 check(attempts>=0),
 last_verified_counter bigint not null default 0 check(last_verified_counter>=0),
 window_start timestamptz not null default now(),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table colorwin_private.admin_superadmin_totp enable row level security;
revoke all on colorwin_private.admin_superadmin_totp from public,anon,authenticated;

create or replace function colorwin_private.admin_superadmin_totp_gateway(
 p_operation text,
 p_session text,
 p_data jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 cfg colorwin_private.admin_token_config;
 g colorwin_private.admin_key_sessions;
 factor colorwin_private.admin_superadmin_totp;
 h text;
 k text;
 counter bigint;
 server_counter bigint;
 valid_key boolean;
begin
 if p_operation not in ('status','enroll','resume','verify','verified','enable') then
  return jsonb_build_object('ok',false,'error','Unknown authenticator operation');
 end if;
 if p_session is null or p_session !~ '^[a-f0-9]{64}$' then
  return jsonb_build_object('ok',false,'error','ADMIN_TOKEN_REQUIRED: Unlock Superadmin first');
 end if;
 h:=encode(extensions.digest(p_session,'sha256'),'hex');
 select * into cfg from colorwin_private.admin_token_config where singleton for share;
 select * into g from colorwin_private.admin_key_sessions
  where session_hash=h and version=cfg.version and expires_at>now() for update;
 if g.session_hash is null or g.panel_scope<>'superadmin' or not exists(
  select 1 from colorwin_private.admin_members m
  join public.profiles p on p.id=m.user_id
  where m.user_id=g.user_id and m.active and m.role='owner' and not p.is_blocked
 ) then
  return jsonb_build_object('ok',false,'error','ADMIN_TOKEN_REQUIRED: Unlock Superadmin first');
 end if;

 select * into factor from colorwin_private.admin_superadmin_totp where singleton for update;
 if p_operation='status' then
  return jsonb_build_object('ok',true,'enabled',coalesce(factor.enabled,false),'pending',factor.singleton is not null and not factor.enabled);
 end if;

 if p_operation in ('enroll','resume') then
  k:=p_data->>'current_key';
  valid_key:=k is not null and char_length(k) between 16 and 256 and octet_length(k)<=256 and k !~ '[[:cntrl:]]'
   and (case when cfg.token_hash_scheme='sha256-bcrypt'
    then extensions.crypt(encode(extensions.digest(convert_to(k,'UTF8'),'sha256'),'hex'),cfg.token_hash)
    else extensions.crypt(k,cfg.token_hash)
   end)=cfg.token_hash;
  if not valid_key then return jsonb_build_object('ok',false,'error','Incorrect current Superadmin key');end if;
  if p_operation='resume' then
   if factor.singleton is null or factor.enabled then return jsonb_build_object('ok',false,'error','No pending authenticator setup');end if;
   return jsonb_build_object('ok',true,'pending',true,'secret_ciphertext',factor.secret_ciphertext,'secret_nonce',factor.secret_nonce);
  end if;
  if factor.enabled then return jsonb_build_object('ok',false,'error','Authenticator is already enabled');end if;
  if length(coalesce(p_data->>'secret_ciphertext','')) not between 50 and 512
   or length(coalesce(p_data->>'secret_nonce','')) not between 12 and 64 then
   return jsonb_build_object('ok',false,'error','Invalid encrypted authenticator secret');
  end if;
  insert into colorwin_private.admin_superadmin_totp(singleton,secret_ciphertext,secret_nonce,enabled,attempts,last_verified_counter,window_start,updated_by,updated_at)
  values(true,p_data->>'secret_ciphertext',p_data->>'secret_nonce',false,0,0,now(),g.user_id,now())
  on conflict(singleton) do update set secret_ciphertext=excluded.secret_ciphertext,secret_nonce=excluded.secret_nonce,
   enabled=false,attempts=0,last_verified_counter=0,window_start=now(),updated_by=excluded.updated_by,updated_at=now();
  insert into colorwin_private.admin_audit(actor,action,target,after_data,reason)
  values(g.user_id,'admin_totp_enrollment_started','superadmin',jsonb_build_object('enabled',false),'Started Superadmin authenticator enrollment');
  return jsonb_build_object('ok',true,'pending',true);
 end if;

 if factor.singleton is null then return jsonb_build_object('ok',false,'error','Set up an authenticator before rotating the key');end if;
 if p_operation='verify' then
  if factor.attempts>=10 and factor.window_start>now()-interval '15 minutes' then
   return jsonb_build_object('ok',false,'error','Too many authenticator attempts. Try again after 15 minutes');
  end if;
  if factor.window_start<=now()-interval '15 minutes' then
   update colorwin_private.admin_superadmin_totp set attempts=1,window_start=now() where singleton returning * into factor;
  else
   update colorwin_private.admin_superadmin_totp set attempts=attempts+1 where singleton returning * into factor;
  end if;
  return jsonb_build_object('ok',true,'enabled',factor.enabled,'secret_ciphertext',factor.secret_ciphertext,'secret_nonce',factor.secret_nonce);
 end if;

 if p_operation='verified' then
  if coalesce(p_data->>'counter','') !~ '^[0-9]{1,16}$' then
   return jsonb_build_object('ok',false,'error','Invalid authenticator counter');
  end if;
  counter:=(p_data->>'counter')::bigint;
  server_counter:=floor(extract(epoch from clock_timestamp())/30)::bigint;
  if counter<=factor.last_verified_counter or counter not between server_counter-1 and server_counter+1 then
   return jsonb_build_object('ok',false,'error','Authenticator code has expired or was already used');
  end if;
  update colorwin_private.admin_superadmin_totp set attempts=0,last_verified_counter=counter,window_start=now() where singleton;
  return jsonb_build_object('ok',true);
 end if;

 if p_operation='enable' then
  if factor.enabled then return jsonb_build_object('ok',true,'enabled',true);end if;
  update colorwin_private.admin_superadmin_totp set enabled=true,attempts=0,window_start=now(),updated_by=g.user_id,updated_at=now() where singleton;
  insert into colorwin_private.admin_audit(actor,action,target,after_data,reason)
  values(g.user_id,'admin_totp_enabled','superadmin',jsonb_build_object('enabled',true),'Enabled Superadmin authenticator verification');
  return jsonb_build_object('ok',true,'enabled',true);
 end if;
 return jsonb_build_object('ok',false,'error','Invalid authenticator operation');
end $$;

create or replace function public.colorwin_admin_totp_gateway(
 p_operation text,
 p_session text default null,
 p_data jsonb default '{}'::jsonb
) returns jsonb
language sql security invoker set search_path='' as $$
 select colorwin_private.admin_superadmin_totp_gateway(p_operation,p_session,p_data)
$$;

revoke all on function colorwin_private.admin_superadmin_totp_gateway(text,text,jsonb),
 public.colorwin_admin_totp_gateway(text,text,jsonb) from public,anon,authenticated;
grant usage on schema colorwin_private to service_role;
grant execute on function colorwin_private.admin_superadmin_totp_gateway(text,text,jsonb),
 public.colorwin_admin_totp_gateway(text,text,jsonb) to service_role;

commit;
