create or replace function colorwin_private.tournament_action(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=colorwin_private.assert_active();t public.cw_tournaments;e public.cw_tournament_entries;bal numeric;begin
 if p_action='load' then return jsonb_build_object('tournaments',coalesce((select jsonb_agg(to_jsonb(x) order by starts_at) from public.cw_tournaments x where status<>'draft'),'[]'::jsonb),'entries',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from(select en.*,tm.title,tm.game,tm.mode,tm.starts_at from public.cw_tournament_entries en join public.cw_tournaments tm on tm.id=en.tournament_id where en.user_id=u order by en.created_at desc limit 200)x),'[]'::jsonb));
 elsif p_action='join' then
  if not coalesce((select (value->>'tournamentsEnabled')::boolean from colorwin_private.site_settings where key='site'),false) then raise exception 'Tournament registrations temporarily disabled';end if;
  select * into t from public.cw_tournaments where id=(p_data->>'id')::uuid for update;if not found or t.status<>'open' or t.starts_at<=now() then raise exception 'Registration closed';end if;
  if t.game='pubg' then raise exception 'PUBG coming soon';end if;
  if (select count(*) from public.cw_tournament_entries where tournament_id=t.id and status<>'cancelled')>=t.capacity then raise exception 'Tournament full';end if;
  if coalesce(p_data->>'player_id','') !~ '^[0-9]{5,20}$' or coalesce(char_length(p_data->>'player_name'),0) not between 2 and 40 then raise exception 'Enter valid game UID and player name';end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,94));select coalesce(sum(amount),0) into bal from public.account_wallet_ledger where user_id=u;if bal<t.entry_fee then raise exception 'Insufficient wallet balance';end if;
  insert into public.cw_tournament_entries(tournament_id,user_id,player_id,player_name) values(t.id,u,p_data->>'player_id',p_data->>'player_name') returning * into e;
  if t.entry_fee>0 then insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,-t.entry_fee,'tournament_entry','tournament-entry:'||e.id);end if;return to_jsonb(e);
 elsif p_action='room' then
  if not exists(select 1 from public.cw_tournament_entries en join public.cw_tournaments tm on tm.id=en.tournament_id where en.user_id=u and en.tournament_id=(p_data->>'id')::uuid and en.status<>'cancelled' and tm.status='live') then raise exception 'Room only available to registered players during a live match';end if;
  return coalesce((select jsonb_build_object('room_id',room_id,'password',password) from colorwin_private.tournament_rooms where tournament_id=(p_data->>'id')::uuid),'{}'::jsonb);
 end if;raise exception 'Unknown tournament action';end $$;
