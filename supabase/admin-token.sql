begin;
create table colorwin_private.admin_token_config (
 singleton boolean primary key default true check(singleton), token_hash text not null,
 version bigint not null default 1, updated_by uuid not null references auth.users(id), updated_at timestamptz not null default now()
);
create table colorwin_private.admin_token_grants (
 session_id uuid primary key references auth.sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id), version bigint not null, expires_at timestamptz not null
);
create table colorwin_private.admin_token_attempts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 attempts integer not null default 0, window_start timestamptz not null default now()
);
alter table colorwin_private.admin_token_config enable row level security;
alter table colorwin_private.admin_token_grants enable row level security;
alter table colorwin_private.admin_token_attempts enable row level security;
revoke all on colorwin_private.admin_token_config,colorwin_private.admin_token_grants,colorwin_private.admin_token_attempts from public,anon,authenticated;
alter function colorwin_private.require_admin(text) rename to require_admin_membership;
create function colorwin_private.admin_token_unlocked() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from colorwin_private.admin_token_grants g
 join colorwin_private.admin_token_config c on c.version=g.version
 join auth.sessions s on s.id=g.session_id and s.user_id=g.user_id
 where g.user_id=auth.uid() and g.session_id=nullif(auth.jwt()->>'session_id','')::uuid and g.expires_at>now())
$$;
create function colorwin_private.require_admin(p_scope text) returns text language plpgsql security definer set search_path='' as $$
declare r text;begin
 r:=colorwin_private.require_admin_membership(p_scope);
 perform 1 from colorwin_private.admin_token_config where singleton for share;
 if not colorwin_private.admin_token_unlocked() then raise exception 'ADMIN_TOKEN_REQUIRED: Unlock the panel with your access token' using errcode='42501';end if;
 return r;
end $$;
create or replace function colorwin_private.support_admin() returns boolean language sql stable security definer set search_path='' as $$
 select colorwin_private.admin_token_unlocked() and exists(select 1 from colorwin_private.admin_members a join public.profiles p on p.id=a.user_id where a.user_id=auth.uid() and a.active and not p.is_blocked and a.role in ('owner','support'))
$$;
create function colorwin_private.admin_token_action(p_action text,p_token text,p_current text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r text;sid uuid;cfg colorwin_private.admin_token_config;attempt colorwin_private.admin_token_attempts;begin
 r:=colorwin_private.require_admin_membership('read');
 sid:=nullif(auth.jwt()->>'session_id','')::uuid;
 if sid is null or not exists(select 1 from auth.sessions where id=sid and user_id=u) then raise exception 'Please sign in again to establish a valid admin session' using errcode='42501';end if;
 if p_action='status' then return jsonb_build_object('role',r,'configured',exists(select 1 from colorwin_private.admin_token_config),'unlocked',colorwin_private.admin_token_unlocked());end if;
 if p_action='lock' then delete from colorwin_private.admin_token_grants where session_id=sid and user_id=u;return jsonb_build_object('ok',true);end if;
 if p_action not in ('setup','unlock','rotate') then raise exception 'Unknown token action';end if;
 if p_action in ('setup','rotate') and r<>'owner' then raise exception 'Only the owner can change the access token' using errcode='42501';end if;
 if p_token is null or p_token !~ '^[A-Za-z0-9_-]{16,64}$' then return jsonb_build_object('ok',false,'error','Use a 16–64 character token with letters, numbers, hyphens or underscores');end if;
 perform pg_advisory_xact_lock(785214);
 select * into cfg from colorwin_private.admin_token_config where singleton for update;
 if p_action='setup' and cfg.token_hash is not null then raise exception 'Access token already configured';end if;
 if p_action<>'setup' and cfg.token_hash is null then raise exception 'Owner must set up the token first';end if;
 insert into colorwin_private.admin_token_attempts(user_id) values(u) on conflict do nothing;
 select * into attempt from colorwin_private.admin_token_attempts where user_id=u for update;
 if attempt.window_start<=now()-interval '15 minutes' then update colorwin_private.admin_token_attempts set attempts=0,window_start=now() where user_id=u;attempt.attempts:=0;end if;
 if attempt.attempts>=5 then return jsonb_build_object('ok',false,'error','Too many incorrect tokens. Try again after 15 minutes');end if;
 if p_action='rotate' and not colorwin_private.admin_token_unlocked() then raise exception 'ADMIN_TOKEN_REQUIRED: Unlock the panel before changing the token' using errcode='42501';end if;
 if (p_action='unlock' and extensions.crypt(p_token,cfg.token_hash)<>cfg.token_hash) or
 (p_action='rotate' and (p_current is null or octet_length(p_current)>64 or extensions.crypt(p_current,cfg.token_hash)<>cfg.token_hash)) then
  update colorwin_private.admin_token_attempts set attempts=attempts+1 where user_id=u;
  return jsonb_build_object('ok',false,'error','Incorrect access token');
 end if;
 if p_action='rotate' and extensions.crypt(p_token,cfg.token_hash)=cfg.token_hash then return jsonb_build_object('ok',false,'error','New token must differ from the current token');end if;
 if p_action in ('setup','rotate') then
  insert into colorwin_private.admin_token_config(singleton,token_hash,updated_by) values(true,extensions.crypt(p_token,extensions.gen_salt('bf',10)),u)
  on conflict(singleton) do update set token_hash=excluded.token_hash,version=admin_token_config.version+1,updated_by=u,updated_at=now() returning * into cfg;
  delete from colorwin_private.admin_token_grants;
  perform colorwin_private.log_admin('admin_token_'||p_action,'panel',null,jsonb_build_object('version',cfg.version),'Owner updated admin access token');
 end if;
 update colorwin_private.admin_token_attempts set attempts=0,window_start=now() where user_id=u;
 insert into colorwin_private.admin_token_grants(session_id,user_id,version,expires_at) values(sid,u,cfg.version,now()+interval '12 hours')
 on conflict(session_id) do update set version=excluded.version,expires_at=excluded.expires_at;
 return jsonb_build_object('ok',true,'role',r,'unlocked',true);
end $$;
create function public.colorwin_admin_token(p_action text default 'status',p_token text default null,p_current text default null) returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.admin_token_action(p_action,p_token,p_current)$$;
revoke all on function colorwin_private.require_admin(text),colorwin_private.admin_token_unlocked(),colorwin_private.admin_token_action(text,text,text) from public,anon,authenticated;
grant execute on function colorwin_private.admin_token_action(text,text,text) to authenticated;
revoke all on function public.colorwin_admin_token(text,text,text) from public,anon;
grant execute on function public.colorwin_admin_token(text,text,text) to authenticated;
commit;
