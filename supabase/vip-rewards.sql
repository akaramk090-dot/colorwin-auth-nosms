-- Award VIP experience for trusted game ledger entries and support one-time,
-- server-validated level-up reward claims.
begin;

create schema if not exists colorwin_private;

lock table public.account_game_records in share row exclusive mode;

create table if not exists colorwin_private.vip_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  experience numeric(18,2) not null default 0 check (experience >= 0),
  updated_at timestamptz not null default clock_timestamp()
);

create table if not exists colorwin_private.vip_level_reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level integer not null check (level between 1 and 10),
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default clock_timestamp(),
  unique (user_id, level)
);
create index if not exists vip_level_reward_claims_user_created
  on colorwin_private.vip_level_reward_claims(user_id, created_at desc);

alter table colorwin_private.vip_progress enable row level security;
alter table colorwin_private.vip_level_reward_claims enable row level security;
revoke all on colorwin_private.vip_progress, colorwin_private.vip_level_reward_claims
  from public, anon, authenticated;

insert into colorwin_private.vip_progress(user_id, experience)
select user_id, sum(bet)
from public.account_game_records
where bet > 0
group by user_id
on conflict (user_id) do update
set experience = excluded.experience, updated_at = clock_timestamp();

create or replace function colorwin_private.vip_award_game_experience()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.bet > 0 then
    insert into colorwin_private.vip_progress as current_progress(user_id, experience)
    values (new.user_id, new.bet)
    on conflict (user_id) do update
      set experience = current_progress.experience + excluded.experience,
          updated_at = clock_timestamp();
  end if;
  return new;
end;
$$;
revoke all on function colorwin_private.vip_award_game_experience()
  from public, anon, authenticated;

drop trigger if exists colorwin_vip_game_experience on public.account_game_records;
create trigger colorwin_vip_game_experience
after insert on public.account_game_records
for each row execute function colorwin_private.vip_award_game_experience();

create or replace function colorwin_private.vip_data(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if p_user is null then
    raise exception 'Sign in to continue';
  end if;

  select jsonb_build_object(
    'experience', coalesce((select p.experience
      from colorwin_private.vip_progress p where p.user_id = p_user), 0),
    'claimed_levels', coalesce((select array_agg(c.level order by c.level)
      from colorwin_private.vip_level_reward_claims c where c.user_id = p_user), '{}'::integer[]),
    'history', coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc)
      from (
        select 'VIP' || c.level || ' level-up reward' as title, c.amount, c.created_at
        from colorwin_private.vip_level_reward_claims c
        where c.user_id = p_user
        order by c.created_at desc
        limit 100
      ) h), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function colorwin_private.vip_data(uuid) from public, anon, authenticated;

create or replace function public.colorwin_vip_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare u uuid := auth.uid();
begin
  if u is null then
    raise exception 'Sign in to continue';
  end if;
  return colorwin_private.vip_data(u);
end;
$$;

create or replace function public.colorwin_vip_claim(p_level integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := auth.uid();
  exp numeric(18,2);
  claim_amount numeric(14,2);
  thresholds numeric[] := array[
    3000, 30000, 400000, 4000000, 20000000,
    80000000, 300000000, 1000000000, 5000000000, 10000000000
  ];
  rewards numeric[] := array[60, 180, 690, 1690, 6900, 16900, 69000, 169000, 690000, 1690000];
  claimed_id uuid;
begin
  if u is null then
    raise exception 'Sign in to continue';
  end if;
  if p_level is null or p_level < 1 or p_level > 10 then
    raise exception 'Invalid VIP level';
  end if;

  select p.experience into exp
  from colorwin_private.vip_progress p
  where p.user_id = u
  for update;
  exp := coalesce(exp, 0);
  if exp < thresholds[p_level] then
    raise exception 'VIP level is not unlocked yet';
  end if;

  claim_amount := rewards[p_level];
  insert into colorwin_private.vip_level_reward_claims(user_id, level, amount)
  values (u, p_level, claim_amount)
  on conflict (user_id, level) do nothing
  returning id into claimed_id;
  if claimed_id is null then
    raise exception 'This VIP level reward has already been claimed';
  end if;

  insert into public.account_wallet_ledger(user_id, amount, source, reference)
  values (u, claim_amount, 'vip_level_reward', 'vip-level:' || u::text || ':' || p_level::text);

  return colorwin_private.vip_data(u);
end;
$$;

revoke all on function public.colorwin_vip_data(), public.colorwin_vip_claim(integer)
  from public, anon, authenticated;
grant execute on function public.colorwin_vip_data(), public.colorwin_vip_claim(integer)
  to authenticated;

commit;
