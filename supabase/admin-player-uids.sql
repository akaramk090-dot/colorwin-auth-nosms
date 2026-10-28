begin;
alter function colorwin_private.admin_list(text,text,integer) rename to admin_list_internal;
create function colorwin_private.admin_list(p_section text,p_search text,p_page integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;ids uuid[];labels jsonb;begin
 result:=colorwin_private.admin_list_internal(p_section,p_search,p_page);
 select array_agg(distinct (m[1])::uuid) into ids from regexp_matches(result::text,'([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})','g') m;
 select coalesce(jsonb_object_agg(id,label),'{}') into labels from (
  select p.id::text id,'UID '||p.public_uid::text label from public.profiles p where p.id=any(ids)
  union all select t.id::text,t.title from public.cw_tournaments t where t.id=any(ids)
  union all select d.id::text,d.number from public.cw_deposit_requests d where d.id=any(ids)
  union all select w.id::text,w.number from public.cw_withdraw_requests w where w.id=any(ids)
  union all select s.id::text,s.number from public.support_tickets s where s.id=any(ids)
 ) x;
 if p_section='users' then select jsonb_set(result,'{rows}',coalesce(jsonb_agg(value||jsonb_build_object('inviter_uid',(select p.public_uid from public.profiles p where p.id=nullif(value->>'inviter_id','')::uuid))),'[]')) into result from jsonb_array_elements(result->'rows');end if;
 if p_section='admins' then select jsonb_set(result,'{rows}',coalesce(jsonb_agg(value||jsonb_build_object('public_uid',(select p.public_uid from public.profiles p where p.id=(value->>'user_id')::uuid))),'[]')) into result from jsonb_array_elements(result->'rows');end if;
 return result||jsonb_build_object('id_labels',labels);
end $$;
revoke all on function colorwin_private.admin_list(text,text,integer) from public,anon,authenticated;
grant execute on function colorwin_private.admin_list(text,text,integer) to authenticated;
alter function colorwin_private.admin_action(text,jsonb,text) rename to admin_action_internal;
create function colorwin_private.admin_action(p_action text,p_data jsonb,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid;begin
 if p_action='admin_access' and p_data ? 'public_uid' then
  perform colorwin_private.require_admin('owner');
  select id into target from public.profiles where public_uid::text=btrim(p_data->>'public_uid');
  if target is null then raise exception 'No Color Win player found with this UID';end if;
  p_data:=(p_data-'public_uid')||jsonb_build_object('user_id',target);
 end if;
 return colorwin_private.admin_action_internal(p_action,p_data,p_reason);
end $$;
revoke all on function colorwin_private.admin_action(text,jsonb,text) from public,anon,authenticated;
grant execute on function colorwin_private.admin_action(text,jsonb,text) to authenticated;
commit;
