-- Disable the removed feature; retain financial audit records and existing wallet credits.
begin;
revoke all on function public.colorwin_wheel(text,integer,uuid) from public,anon,authenticated;
revoke all on function colorwin_private.wheel_action(text,integer,uuid) from public,anon,authenticated;
commit;
