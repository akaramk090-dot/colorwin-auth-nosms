alter table colorwin_private.admin_token_config
 add column if not exists token_hash_scheme text not null default 'bcrypt';
alter table colorwin_private.admin_token_config drop constraint if exists admin_token_config_hash_scheme_check;
alter table colorwin_private.admin_token_config
 add constraint admin_token_config_hash_scheme_check check(token_hash_scheme in ('bcrypt','sha256-bcrypt'));

do $migration$
declare
 definition text:=pg_get_functiondef('colorwin_private.admin_key_gateway(text,text,jsonb)'::regprocedure);
 old_hash text:=$old$extensions.crypt(encode(extensions.digest(convert_to(k,'UTF8'),'sha256'),'hex'),cfg.token_hash)$old$;
 new_hash text:=$new$(case when cfg.token_hash_scheme='sha256-bcrypt'
    then extensions.crypt(encode(extensions.digest(convert_to(k,'UTF8'),'sha256'),'hex'),cfg.token_hash)
    else extensions.crypt(k,cfg.token_hash)
   end)$new$;
 old_store text:=$old$set token_hash=extensions.crypt(encode(extensions.digest(convert_to(k,'UTF8'),'sha256'),'hex'),extensions.gen_salt('bf',10)),version=version+1,updated_at=now(),updated_by=g.user_id$old$;
 new_store text:=$new$set token_hash=extensions.crypt(encode(extensions.digest(convert_to(k,'UTF8'),'sha256'),'hex'),extensions.gen_salt('bf',10)),token_hash_scheme='sha256-bcrypt',version=version+1,updated_at=now(),updated_by=g.user_id$new$;
begin
 if (length(definition)-length(replace(definition,old_hash,'')))/length(old_hash)<>3
  or position(old_store in definition)=0 then
  raise exception 'Unexpected admin_key_gateway definition; no changes applied';
 end if;

 definition:=replace(definition,old_hash,new_hash);
 definition:=replace(definition,old_store,new_store);
 execute definition;
end
$migration$;
