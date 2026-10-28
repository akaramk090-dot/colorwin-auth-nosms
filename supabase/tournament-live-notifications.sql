create table colorwin_private.tournament_live_notices(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),tournament_id uuid not null references public.cw_tournaments(id),created_at timestamptz not null default now(),unique(user_id,tournament_id));
create index tournament_live_notices_user on colorwin_private.tournament_live_notices(user_id,created_at desc);
alter table colorwin_private.tournament_live_notices enable row level security;
revoke all on colorwin_private.tournament_live_notices from public,anon,authenticated;
create function colorwin_private.notify_tournament_live() returns trigger language plpgsql security definer set search_path='' as $$
declare n record;begin
 if new.status='live' and old.status is distinct from 'live' then
 for n in insert into colorwin_private.tournament_live_notices(user_id,tournament_id)
 select user_id,new.id from public.cw_tournament_entries where tournament_id=new.id and status<>'cancelled'
 on conflict(user_id,tournament_id) do nothing returning id,user_id loop
 insert into public.account_notifications(id,user_id,kind,title,message) values(n.id,n.user_id,'account','Your tournament is LIVE!',new.title||' has started. Open My matches and tap JOIN MATCH to enter your room.');
 end loop;end if;return new;
end $$;
revoke all on function colorwin_private.notify_tournament_live() from public,anon,authenticated;
create trigger tournament_live_notification after update of status on public.cw_tournaments for each row execute function colorwin_private.notify_tournament_live();
create function colorwin_private.live_match_notices() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=colorwin_private.assert_active();begin
 return coalesce((select jsonb_agg(to_jsonb(x)) from(
 select n.id,n.tournament_id,n.created_at,t.title,t.game,t.mode from colorwin_private.tournament_live_notices n join public.cw_tournaments t on t.id=n.tournament_id
 where n.user_id=u and t.status='live' and exists(select 1 from public.cw_tournament_entries e where e.tournament_id=t.id and e.user_id=u and e.status<>'cancelled')
 order by n.created_at desc,n.id desc limit 50)x),'[]'::jsonb);
end $$;
revoke all on function colorwin_private.live_match_notices() from public,anon;
grant execute on function colorwin_private.live_match_notices() to authenticated;
create function public.colorwin_live_match_notices() returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.live_match_notices();$$;
revoke all on function public.colorwin_live_match_notices() from public,anon;
grant execute on function public.colorwin_live_match_notices() to authenticated;

