create table colorwin_private.lottery_worker_settings(id boolean primary key default true check(id),secret text not null default encode(extensions.gen_random_bytes(32),'hex'));
alter table colorwin_private.lottery_worker_settings enable row level security;
revoke all on colorwin_private.lottery_worker_settings from public,anon,authenticated;
insert into colorwin_private.lottery_worker_settings(id) values(true);
create function colorwin_private.lottery_worker_config() returns jsonb language sql security definer set search_path='' as $$select jsonb_build_object('secret',secret) from colorwin_private.lottery_worker_settings where id;$$;
revoke all on function colorwin_private.lottery_worker_config() from public,anon,authenticated;
grant execute on function colorwin_private.lottery_worker_config() to service_role;
create function public.colorwin_lottery_worker_config() returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.lottery_worker_config();$$;
revoke all on function public.colorwin_lottery_worker_config() from public,anon,authenticated;
grant execute on function public.colorwin_lottery_worker_config() to service_role;
grant execute on function colorwin_private.lottery_settle_due() to service_role;
create function public.colorwin_lottery_worker_settle() returns void language sql security invoker set search_path='' as $$select colorwin_private.lottery_settle_due();$$;
revoke all on function public.colorwin_lottery_worker_settle() from public,anon,authenticated;
grant execute on function public.colorwin_lottery_worker_settle() to service_role;
create function colorwin_private.lottery_worker_tick() returns void language plpgsql security definer set search_path='' as $$
declare key text;begin
 if not exists(select 1 from colorwin_private.lottery_bets where game='trx-wingo' and status='pending') then return;end if;
 select secret into key from colorwin_private.lottery_worker_settings where id;
 perform net.http_post(url:='https://lwzqbhmdfkbycdizieff.supabase.co/functions/v1/trx-lottery',headers:=jsonb_build_object('Content-Type','application/json','x-lottery-cron',key),body:='{"cron":true}'::jsonb,timeout_milliseconds:=45000);
end $$;
revoke all on function colorwin_private.lottery_worker_tick() from public,anon,authenticated;
select cron.schedule('colorwin-trx-sync','* * * * *','select colorwin_private.lottery_worker_tick();');
