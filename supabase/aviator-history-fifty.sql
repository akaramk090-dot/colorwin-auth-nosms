-- Limit the shared round-history response to the latest 50 persisted results.
-- Retain all stored rounds for settlement and audit purposes.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('colorwin_private.aviator_action(text,jsonb)'::regprocedure);
 if position('where is_shared and crash_at<=moment order by starts_at desc limit 100' in definition)=0 then
  raise exception 'Expected shared history query not found';
 end if;
 definition:=replace(definition,'where is_shared and crash_at<=moment order by starts_at desc limit 100','where is_shared and crash_at<=moment order by starts_at desc limit 50');
 execute definition;
end $migration$;
