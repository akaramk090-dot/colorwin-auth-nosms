do $migration$
declare
 definition text:=pg_get_functiondef('colorwin_private.admin_key_gateway(text,text,jsonb)'::regprocedure);
 old_unlock_guard text:=$old$k:=p_data->>'key';
  if k is null or k !~ '^[A-Za-z0-9_-]{16,64}$' then$old$;
 old_rotate_current text:=$old$if k is null or k !~ '^[A-Za-z0-9_-]{16,64}$' or extensions.crypt(k,cfg.token_hash)<>cfg.token_hash then$old$;
 old_rotate_new text:=$old$k:=p_data->>'token';
  if k is null or k !~ '^[A-Za-z0-9_-]{16,64}$' then$old$;
 old_hash text:=$old$extensions.crypt(k,cfg.token_hash)$old$;
 old_rotate_store text:=$old$set token_hash=extensions.crypt(k,extensions.gen_salt('bf',10)),version=version+1,updated_at=now(),updated_by=g.user_id$old$;
begin
 if position(old_unlock_guard in definition)=0
  or position(old_rotate_current in definition)=0
  or position(old_rotate_new in definition)=0
  or (length(definition)-length(replace(definition,old_hash,'')))/length(old_hash)<>3
  or position(old_rotate_store in definition)=0 then
  raise exception 'Unexpected admin_key_gateway definition; no changes applied';
 end if;

 definition:=replace(
  definition,
  old_unlock_guard,
  $new$k:=p_data->>'key';
  if k is null or (panel='superadmin' and (char_length(k) not between 16 and 256 or octet_length(k)>256 or k ~ '[[:cntrl:]]'))
   or (panel<>'superadmin' and k !~ '^[A-Za-z0-9_-]{16,64}$') then$new$
 );
 definition:=replace(
  definition,
  old_rotate_current,
  $new$if k is null or char_length(k) not between 16 and 256 or octet_length(k)>256 or k ~ '[[:cntrl:]]'
   or extensions.crypt(encode(extensions.digest(convert_to(k,'UTF8'),'sha256'),'hex'),cfg.token_hash)<>cfg.token_hash then$new$
 );
 definition:=replace(
  definition,
  old_rotate_new,
  $new$k:=p_data->>'token';
  if k is null or char_length(k) not between 16 and 256 or octet_length(k)>256 or k ~ '[[:cntrl:]]' then$new$
 );
 definition:=replace(
  definition,
  old_hash,
  $new$extensions.crypt(encode(extensions.digest(convert_to(k,'UTF8'),'sha256'),'hex'),cfg.token_hash)$new$
 );
 definition:=replace(
  definition,
  old_rotate_store,
  $new$set token_hash=extensions.crypt(encode(extensions.digest(convert_to(k,'UTF8'),'sha256'),'hex'),extensions.gen_salt('bf',10)),version=version+1,updated_at=now(),updated_by=g.user_id$new$
 );

 execute definition;
end
$migration$;
