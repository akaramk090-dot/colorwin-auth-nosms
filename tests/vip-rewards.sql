-- Synthetic users and wallet entries are rolled back after this test.
begin;
insert into auth.users(id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-4000-a000-000000000081', 'authenticated', 'authenticated', 'vip-rewards-81@example.invalid', '{}'),
  ('00000000-0000-4000-a000-000000000082', 'authenticated', 'authenticated', 'vip-rewards-82@example.invalid', '{}'),
  ('00000000-0000-4000-a000-000000000083', 'authenticated', 'authenticated', 'vip-rewards-83@example.invalid', '{}');

insert into public.account_game_records(user_id, category, game_name, bet, winnings)
values
  ('00000000-0000-4000-a000-000000000081', 'lottery', 'VIP test small bet', 2999.50, 0),
  ('00000000-0000-4000-a000-000000000082', 'video', 'VIP test isolated bet', 1, 0),
  ('00000000-0000-4000-a000-000000000083', 'lottery', 'VIP test full-tier bet', 10000000000, 0);

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000081","role":"authenticated"}', true);
set local role authenticated;
do $$
declare d jsonb; i integer;
begin
  d := public.colorwin_vip_data();
  if (d->>'experience')::numeric <> 2999.50 then
    raise exception 'Bet stake did not become the same amount of VIP experience';
  end if;
  if has_function_privilege('anon', 'public.colorwin_vip_claim(integer)', 'execute') then
    raise exception 'VIP claim callable without authentication';
  end if;
  begin
    perform public.colorwin_vip_claim(1);
    raise exception 'Claim before experience threshold accepted';
  exception when others then
    if sqlerrm not like '%not unlocked%' then raise; end if;
  end;
end $$;
reset role;

insert into public.account_game_records(user_id, category, game_name, bet, winnings)
values ('00000000-0000-4000-a000-000000000081', 'lottery', 'VIP threshold bet', 0.50, 0);
set local role authenticated;
do $$
declare d jsonb; i integer; expected numeric[] := array[60,180,690,1690,6900,16900,69000,169000,690000,1690000];
begin
  d := public.colorwin_vip_claim(1);
  if (select sum(amount) from public.account_wallet_ledger
      where user_id=auth.uid() and source='vip_level_reward') <> expected[1] then
    raise exception 'VIP1 reward was not credited';
  end if;
  begin
    perform public.colorwin_vip_claim(1);
    raise exception 'Duplicate VIP reward claim accepted';
  exception when others then
    if sqlerrm not like '%already been claimed%' then raise; end if;
  end;
  if (d->'claimed_levels')::text not like '%1%' then
    raise exception 'Claimed VIP level missing from response';
  end if;
  if (select sum(amount) from public.account_wallet_ledger
      where user_id=auth.uid() and source='vip_level_reward') <> expected[1] then
    raise exception 'Duplicate claim credited wallet more than once';
  end if;
  begin
    perform public.colorwin_vip_claim(0);
    raise exception 'Invalid VIP level accepted';
  exception when others then
    if sqlerrm not like '%Invalid VIP level%' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000083","role":"authenticated"}', true);
set local role authenticated;
do $$
declare d jsonb; i integer; expected numeric[] := array[60,180,690,1690,6900,16900,69000,169000,690000,1690000];
begin
  for i in 1..10 loop
    d := public.colorwin_vip_claim(i);
    if not exists(select 1 from jsonb_array_elements_text(d->'claimed_levels') x where x=i::text) then
      raise exception 'VIP level % missing from claim response', i;
    end if;
  end loop;
  if (select sum(amount) from public.account_wallet_ledger
      where user_id=auth.uid() and source='vip_level_reward') <> (select sum(x) from unnest(expected)x) then
    raise exception 'VIP tier rewards or wallet credits do not match';
  end if;
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000082","role":"authenticated"}', true);
set local role authenticated;
do $$
declare d jsonb;
begin
  d := public.colorwin_vip_data();
  if (d->>'experience')::numeric <> 1 then
    raise exception 'VIP experience leaked or mixed between accounts';
  end if;
  if jsonb_array_length(d->'history') <> 0 then
    raise exception 'VIP reward history leaked between accounts';
  end if;
end $$;
reset role;
rollback;
select 'PASS: trusted bet EXP, exact thresholds, atomic one-time reward, access control and account isolation' as vip_rewards;
