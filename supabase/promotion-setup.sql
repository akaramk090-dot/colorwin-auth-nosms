-- Apply after schema.sql in the intended project's SQL Editor as postgres.
-- No client may write inviter relationships or completed deposits.
begin;
create sequence if not exists colorwin_private.invitation_codes
  as bigint start with 10000000000 maxvalue 99999999999 no cycle;
alter table public.profiles add column if not exists invitation_code text;
alter table public.profiles add column if not exists inviter_id uuid references public.profiles(id) on delete set null;
update public.profiles set invitation_code = nextval('colorwin_private.invitation_codes')::text where invitation_code is null;
alter table public.profiles alter column invitation_code set not null;
create unique index if not exists colorwin_invitation_code_unique on public.profiles(invitation_code);
create index if not exists colorwin_inviter_index on public.profiles(inviter_id);
alter table public.profiles add constraint colorwin_invitation_format check (invitation_code ~ '^[0-9]{11}$');
alter table public.profiles add constraint colorwin_no_self_invite check (inviter_id is distinct from id);

-- Invoker is the existing private auth trigger owner, never a browser role.
create or replace function colorwin_private.assign_invitation()
returns trigger language plpgsql set search_path = '' as $$
declare code text;
begin
  new.invitation_code := nextval('colorwin_private.invitation_codes')::text;
  select a.raw_user_meta_data->>'invitation_code' into code from auth.users a where a.id = new.id;
  if code is not null and code <> '' then
    if code !~ '^[0-9]{11}$' then raise exception 'Invalid invitation code'; end if;
    select p.id into new.inviter_id from public.profiles p where p.invitation_code = code;
    if new.inviter_id is null then raise exception 'Invitation code does not exist'; end if;
  end if;
  return new;
end;
$$;
revoke all on function colorwin_private.assign_invitation() from public,anon,authenticated;
drop trigger if exists colorwin_assign_invitation on public.profiles;
create trigger colorwin_assign_invitation before insert on public.profiles
for each row execute function colorwin_private.assign_invitation();

create table if not exists public.promotion_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  payment_reference text not null unique,
  amount numeric(18,2) not null check (amount > 0),
  completed_at timestamptz not null default now()
);
create index if not exists colorwin_deposits_user on public.promotion_deposits(user_id);
alter table public.promotion_deposits enable row level security;
revoke all on public.promotion_deposits from public,anon,authenticated;
grant select on public.promotion_deposits to authenticated;
grant all on public.promotion_deposits to service_role;
drop policy if exists colorwin_own_deposits on public.promotion_deposits;
create policy colorwin_own_deposits on public.promotion_deposits for select to authenticated
using ((select auth.uid()) = user_id);

-- Definer access is required to aggregate descendants while exposing only masked
-- data. Private implementation checks caller identity and accepts no owner ID.
create or replace function colorwin_private.promotion_data()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); result jsonb;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  with recursive team as (
    select p.id,p.public_uid,p.phone,p.created_at,1 as depth,array[caller,p.id] as visited
    from public.profiles p where p.inviter_id = caller
    union all
    select p.id,p.public_uid,p.phone,p.created_at,t.depth+1,t.visited || p.id
    from public.profiles p join team t on p.inviter_id=t.id
    where t.depth < 6 and not p.id = any(t.visited)
  ), members as (
    select t.*,coalesce(d.deposit_count,0) deposit_count,coalesce(d.deposit_amount,0) deposit_amount,d.first_deposit_amount
    from team t left join lateral (
      select count(*) deposit_count,sum(amount) deposit_amount,
        (array_agg(amount order by completed_at,id))[1] first_deposit_amount
      from public.promotion_deposits where user_id=t.id
    ) d on true
  )
  select jsonb_build_object(
    'invitation_code',(select invitation_code from public.profiles where id=caller),
    'members',coalesce((select jsonb_agg(jsonb_build_object('uid',public_uid,'tier',depth,
      'phone_last4',case when phone is null then null else right(phone,4) end,
      'created_at',created_at,'deposit_count',deposit_count,'deposit_amount',deposit_amount,
      'first_deposit_amount',first_deposit_amount) order by created_at desc) from members),'[]'::jsonb),
    'direct',coalesce((select jsonb_agg(jsonb_build_object('uid',public_uid,
      'phone_last4',case when phone is null then null else right(phone,4) end,
      'created_at',created_at,'deposit_count',deposit_count,'deposit_amount',deposit_amount)
      order by created_at desc) from members where depth=1),'[]'::jsonb),
    'direct_stats',(select jsonb_build_object('registers',count(*),
      'deposit_count',coalesce(sum(deposit_count),0),'deposit_amount',coalesce(sum(deposit_amount),0),
      'first_deposits',count(*) filter(where deposit_count>0)) from members where depth=1),
    'team_stats',(select jsonb_build_object('registers',count(*),
      'deposit_count',coalesce(sum(deposit_count),0),'deposit_amount',coalesce(sum(deposit_amount),0),
      'first_deposits',count(*) filter(where deposit_count>0)) from members),
    'this_week',(select count(*) from members where depth=1 and created_at >= date_trunc('week',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')
  ) into result;
  return result;
end;
$$;
revoke all on function colorwin_private.promotion_data() from public,anon,authenticated;
grant usage on schema colorwin_private to authenticated;
grant execute on function colorwin_private.promotion_data() to authenticated;
create or replace function public.colorwin_promotion()
returns jsonb language sql security invoker set search_path = '' as $$
  select colorwin_private.promotion_data();
$$;
revoke all on function public.colorwin_promotion() from public,anon;
grant execute on function public.colorwin_promotion() to authenticated;
commit;
