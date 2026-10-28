create or replace function colorwin_private.transaction_history(p_type text default 'all',p_date date default null,p_cursor jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=colorwin_private.assert_active();result jsonb;
begin
 with ledger as (
  select id,amount,source,reference,created_at,
   sum(amount) over(order by created_at,id rows between unbounded preceding and current row) balance_after
  from public.account_wallet_ledger where user_id=u
 ), page as (
  select * from ledger where
   (p_type='all' or (p_type='credit' and amount>0) or (p_type='debit' and amount<0) or source=p_type)
   and (p_date is null or (created_at >= (p_date::timestamp at time zone 'Asia/Kolkata') and created_at < ((p_date+1)::timestamp at time zone 'Asia/Kolkata')))
   and (p_cursor is null or (created_at,id)<((p_cursor->>'time')::timestamptz,(p_cursor->>'id')::uuid))
  order by created_at desc,id desc limit 101
 ), shown as (select * from page order by created_at desc,id desc limit 100)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(s) order by created_at desc,id desc) from shown s),'[]'::jsonb),
  'has_more',(select count(*)>100 from page),
  'cursor',(select jsonb_build_object('time',created_at,'id',id) from shown order by created_at,id limit 1),
  'types',coalesce((select jsonb_agg(source order by source) from(select distinct source from ledger)t),'[]'::jsonb),
  'balance',coalesce((select sum(amount) from ledger),0)) into result;
 return result;
end $$;
create or replace function public.colorwin_transaction_history(p_type text default 'all',p_date date default null,p_cursor jsonb default null)
returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.transaction_history(p_type,p_date,p_cursor)$$;
revoke all on function colorwin_private.transaction_history(text,date,jsonb),public.colorwin_transaction_history(text,date,jsonb) from public,anon;
grant execute on function colorwin_private.transaction_history(text,date,jsonb),public.colorwin_transaction_history(text,date,jsonb) to authenticated;
notify pgrst,'reload schema';
