begin;
do $$declare f record;definition text;begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='colorwin_private' and p.proname in ('promotion_data','wheel_action') loop
  definition:=pg_get_functiondef(f.oid);
  definition:=regexp_replace(definition,'\mbegin\M','begin perform colorwin_private.assert_player_session();','i');
  execute definition;
 end loop;
end $$;
create policy cw_active_player_session on storage.objects as restrictive for all to authenticated
 using ((select colorwin_private.player_session_allowed())) with check ((select colorwin_private.player_session_allowed()));
commit;
