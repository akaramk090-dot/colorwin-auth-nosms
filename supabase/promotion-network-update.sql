-- Apply only if promotion-setup.sql was already applied.
begin;
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
