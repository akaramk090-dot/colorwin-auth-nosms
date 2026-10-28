create or replace function colorwin_private.lottery_settle_due() returns void language plpgsql security definer set search_path='' as $$declare u uuid;begin
 for u in select distinct user_id from colorwin_private.lottery_bets t where status='pending' and (case when game='trx-wingo' then exists(select 1 from colorwin_private.lottery_results r where r.game=t.game and r.lane=t.lane and r.round_index=t.round_index) else (round_index+1)*lane<=extract(epoch from clock_timestamp()) end) limit 300 loop perform colorwin_private.lottery_settle(u);end loop;
end $$;
