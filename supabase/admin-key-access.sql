begin;
create table colorwin_private.admin_key_sessions (
 session_hash text primary key, user_id uuid not null references auth.users(id) on delete cascade,
 version bigint not null, expires_at timestamptz not null default now()+interval '12 hours'
);
create table colorwin_private.admin_key_attempts (
 bucket text primary key, attempts integer not null default 0, window_start timestamptz not null default now()
);
alter table colorwin_private.admin_key_sessions enable row level security;
alter table colorwin_private.admin_key_attempts enable row level security;
revoke all on colorwin_private.admin_key_sessions,colorwin_private.admin_key_attempts from public,anon,authenticated;
create or replace function colorwin_private.admin_token_unlocked() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from colorwin_private.admin_token_grants g join colorwin_private.admin_token_config c on c.version=g.version join auth.sessions s on s.id=g.session_id and s.user_id=g.user_id where g.user_id=auth.uid() and g.session_id=nullif(auth.jwt()->>'session_id','')::uuid and g.expires_at>now())
 or exists(select 1 from colorwin_private.admin_key_sessions g join colorwin_private.admin_token_config c on c.version=g.version where g.user_id=auth.uid() and g.session_hash=current_setting('colorwin.admin_key_session',true) and g.expires_at>now())
$$;
create function colorwin_private.admin_key_gateway(p_operation text,p_session text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg colorwin_private.admin_token_config;g colorwin_private.admin_key_sessions;raw_session text;h text;k text;result jsonb;attempt colorwin_private.admin_key_attempts;owner_id uuid;claims_before text;context_before text;begin
 if p_operation='unlock' then
  -- Service-only entrypoint: bounded global verification rate, no client identity spoofing.
  insert into colorwin_private.admin_key_attempts(bucket) values('unlock') on conflict do nothing;
  select * into attempt from colorwin_private.admin_key_attempts where bucket='unlock' for update;
  if attempt.window_start<=now()-interval '1 minute' then update colorwin_private.admin_key_attempts set attempts=0,window_start=now() where bucket='unlock';attempt.attempts:=0;end if;
  if attempt.attempts>=20 then return jsonb_build_object('ok',false,'error','Too many access attempts. Try again in one minute');end if;
  update colorwin_private.admin_key_attempts set attempts=attempts+1 where bucket='unlock';
  k:=p_data->>'key';
  if k is null or k !~ '^[A-Za-z0-9_-]{16,64}$' then return jsonb_build_object('ok',false,'error','Incorrect access key');end if;
  select * into cfg from colorwin_private.admin_token_config where singleton for share;
  if cfg.token_hash is null or extensions.crypt(k,cfg.token_hash)<>cfg.token_hash then return jsonb_build_object('ok',false,'error','Incorrect access key');end if;
  select m.user_id into owner_id from colorwin_private.admin_members m join public.profiles p on p.id=m.user_id where m.user_id=cfg.updated_by and m.role='owner' and m.active and not p.is_blocked;
  if owner_id is null then return jsonb_build_object('ok',false,'error','Panel owner access is unavailable');end if;
  raw_session:=encode(extensions.gen_random_bytes(32),'hex');
  h:=encode(extensions.digest(raw_session,'sha256'),'hex');
  delete from colorwin_private.admin_key_sessions where expires_at<=now() or version<>cfg.version;
  insert into colorwin_private.admin_key_sessions(session_hash,user_id,version) values(h,owner_id,cfg.version);
  insert into colorwin_private.admin_audit(actor,action,target,after_data,reason) values(owner_id,'admin_key_unlock','panel',jsonb_build_object('session',left(h,12)),'Panel unlocked using owner access key');
  return jsonb_build_object('ok',true,'session',raw_session,'role','owner','user_id',owner_id);
 end if;
 if p_session is null or p_session !~ '^[a-f0-9]{64}$' then return jsonb_build_object('ok',false,'error','ADMIN_TOKEN_REQUIRED: Enter your access key');end if;
 h:=encode(extensions.digest(p_session,'sha256'),'hex');
 if p_operation='rotate' then select * into cfg from colorwin_private.admin_token_config where singleton for update;
 else select * into cfg from colorwin_private.admin_token_config where singleton for share;end if;
 select * into g from colorwin_private.admin_key_sessions where session_hash=h and version=cfg.version and expires_at>now() for update;
 if g.session_hash is null or not exists(select 1 from colorwin_private.admin_members m join public.profiles p on p.id=m.user_id where m.user_id=g.user_id and m.active and m.role='owner' and not p.is_blocked) then return jsonb_build_object('ok',false,'error','ADMIN_TOKEN_REQUIRED: Session expired. Enter your access key');end if;
 if p_operation='lock' then delete from colorwin_private.admin_key_sessions where session_hash=h;return jsonb_build_object('ok',true);end if;
 if p_operation='status' then return jsonb_build_object('ok',true,'unlocked',true,'configured',true,'role','owner');end if;
 if p_operation='rotate' then
  insert into colorwin_private.admin_key_attempts(bucket) values(h) on conflict do nothing;
  select * into attempt from colorwin_private.admin_key_attempts where bucket=h for update;
  if attempt.window_start<=now()-interval '15 minutes' then update colorwin_private.admin_key_attempts set attempts=0,window_start=now() where bucket=h;attempt.attempts:=0;end if;
  if attempt.attempts>=5 then return jsonb_build_object('ok',false,'error','Too many incorrect current keys. Try again after 15 minutes');end if;
  k:=p_data->>'current';
  if k is null or k !~ '^[A-Za-z0-9_-]{16,64}$' or extensions.crypt(k,cfg.token_hash)<>cfg.token_hash then update colorwin_private.admin_key_attempts set attempts=attempts+1 where bucket=h;return jsonb_build_object('ok',false,'error','Incorrect current access key');end if;
  k:=p_data->>'token';
  if k is null or k !~ '^[A-Za-z0-9_-]{16,64}$' then return jsonb_build_object('ok',false,'error','Use a 16–64 character key with letters, numbers, hyphens or underscores');end if;
  if extensions.crypt(k,cfg.token_hash)=cfg.token_hash then return jsonb_build_object('ok',false,'error','New key must differ from the current key');end if;
  update colorwin_private.admin_token_config set token_hash=extensions.crypt(k,extensions.gen_salt('bf',10)),version=version+1,updated_at=now(),updated_by=g.user_id where singleton returning * into cfg;
  delete from colorwin_private.admin_token_grants;
  delete from colorwin_private.admin_key_sessions where session_hash<>h;
  update colorwin_private.admin_key_sessions set version=cfg.version where session_hash=h;
  delete from colorwin_private.admin_key_attempts where bucket=h;
  insert into colorwin_private.admin_audit(actor,action,target,after_data,reason) values(g.user_id,'admin_key_rotate','panel',jsonb_build_object('version',cfg.version,'session',left(h,12)),'Owner changed panel access key');
  return jsonb_build_object('ok',true);
 end if;
 -- Set verified identity only for this restricted call; restore it before returning.
 claims_before:=current_setting('request.jwt.claims',true);context_before:=current_setting('colorwin.admin_key_session',true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',g.user_id,'role','authenticated')::text,true);
 perform set_config('colorwin.admin_key_session',h,true);
 if p_operation='list' then result:=colorwin_private.admin_list(coalesce(p_data->>'p_section','overview'),coalesce(p_data->>'p_search',''),coalesce((p_data->>'p_page')::integer,0));
 elsif p_operation='action' then
  if coalesce(char_length(btrim(p_data->>'p_reason')),0) not between 3 and 470 then raise exception 'Enter an audit reason (3–470 characters)';end if;
  result:=colorwin_private.admin_action(p_data->>'p_action',p_data->'p_data','[Key session '||left(h,12)||'] '||(p_data->>'p_reason'));
 elsif p_operation='attachment' then
  perform colorwin_private.require_admin('support');
  if not exists(select 1 from public.support_tickets s cross join lateral jsonb_array_elements(s.attachments) a where a->>'path'=p_data->>'path') then raise exception 'Attachment not found';end if;
  result:=jsonb_build_object('path',p_data->>'path');
 else raise exception 'Unknown admin operation';end if;
 perform set_config('request.jwt.claims',coalesce(claims_before,''),true);
 perform set_config('colorwin.admin_key_session',coalesce(context_before,''),true);
 return result;
end $$;
create function public.colorwin_admin_key_gateway(p_operation text,p_session text default null,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.admin_key_gateway(p_operation,p_session,p_data)$$;
revoke all on function colorwin_private.admin_key_gateway(text,text,jsonb),public.colorwin_admin_key_gateway(text,text,jsonb) from public,anon,authenticated;
grant usage on schema colorwin_private to service_role;
grant execute on function colorwin_private.admin_key_gateway(text,text,jsonb),public.colorwin_admin_key_gateway(text,text,jsonb) to service_role;
commit;
