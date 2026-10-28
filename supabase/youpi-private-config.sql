create table colorwin_private.youpi_configuration(singleton boolean primary key default true check(singleton),settings jsonb not null,updated_at timestamptz not null default now());
alter table colorwin_private.youpi_configuration enable row level security;
revoke all on colorwin_private.youpi_configuration from public,anon,authenticated;
create function colorwin_private.youpi_configuration() returns jsonb language sql security definer set search_path='' as $$select settings from colorwin_private.youpi_configuration where singleton;$$;
revoke all on function colorwin_private.youpi_configuration() from public,anon,authenticated;
grant execute on function colorwin_private.youpi_configuration() to service_role;
create function public.colorwin_youpi_configuration() returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.youpi_configuration();$$;
revoke all on function public.colorwin_youpi_configuration() from public,anon,authenticated;
grant execute on function public.colorwin_youpi_configuration() to service_role;
