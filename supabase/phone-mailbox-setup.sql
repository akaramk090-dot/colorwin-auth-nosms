-- Approved and deployed phone-login mailbox lookup.
begin;
-- Preserve phone login after the owner verifies a real mailbox.
create or replace function public.colorwin_phone_login_email(p_phone text)
returns text language sql security definer set search_path='' as $$
 select u.email from public.profiles p join auth.users u on u.id=p.id where p.phone=p_phone limit 1;
$$;
revoke all on function public.colorwin_phone_login_email(text) from public,anon,authenticated;
grant execute on function public.colorwin_phone_login_email(text) to service_role;
commit;


