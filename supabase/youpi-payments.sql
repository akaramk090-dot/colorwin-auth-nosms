alter table public.cw_deposit_requests add column if not exists gateway_provider text;
create table colorwin_private.youpi_payments(deposit_id uuid primary key references public.cw_deposit_requests(id),payment_id uuid unique,checkout_url text,completed_at timestamptz,created_at timestamptz not null default now());
alter table colorwin_private.youpi_payments enable row level security;
revoke all on colorwin_private.youpi_payments from public,anon,authenticated;
create function colorwin_private.youpi_reserve(p_amount numeric,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=colorwin_private.assert_active();d public.cw_deposit_requests;r jsonb;begin
 r:=colorwin_private.wallet_action('create_deposit',jsonb_build_object('amount',p_amount,'method','upi','request_id',p_request));
 select * into d from public.cw_deposit_requests where id=(r->>'id')::uuid and user_id=u for update;
 if d.status<>'to be paid' then raise exception 'Create a new payment order';end if;
 if not exists(select 1 from colorwin_private.youpi_payments where deposit_id=d.id) then
 if d.utr is not null then raise exception 'Order already submitted';end if;
 insert into colorwin_private.youpi_payments(deposit_id) values(d.id);
 update public.cw_deposit_requests set gateway_provider='youpi' where id=d.id;end if;
 return jsonb_build_object('id',d.id,'number',d.number,'amount',d.amount);
end $$;
revoke all on function colorwin_private.youpi_reserve(numeric,uuid) from public,anon;
grant execute on function colorwin_private.youpi_reserve(numeric,uuid) to authenticated;
create function public.colorwin_youpi_reserve(p_amount numeric,p_request uuid) returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.youpi_reserve(p_amount,p_request);$$;
revoke all on function public.colorwin_youpi_reserve(numeric,uuid) from public,anon;
grant execute on function public.colorwin_youpi_reserve(numeric,uuid) to authenticated;
create function colorwin_private.youpi_backend(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.cw_deposit_requests;y colorwin_private.youpi_payments;pid uuid:=(p_data->>'payment_id')::uuid;begin
 select * into d from public.cw_deposit_requests where id=(p_data->>'deposit_id')::uuid for update;
 if not found or d.gateway_provider is distinct from 'youpi' then raise exception 'Gateway order not found';end if;
 select * into y from colorwin_private.youpi_payments where deposit_id=d.id for update;
 if p_action='bind' then
 if y.payment_id is not null and y.payment_id<>pid then raise exception 'Payment already bound';end if;
 if pid is null then raise exception 'Payment ID missing';end if;
 update colorwin_private.youpi_payments set payment_id=pid,checkout_url=p_data->>'checkout_url' where deposit_id=d.id;
 elsif p_action='credit' then
 if y.payment_id is distinct from pid or pid is null or (p_data->>'amount_paise')::bigint is distinct from (d.amount*100)::bigint then raise exception 'Payment identity or amount mismatch';end if;
 if y.completed_at is not null then return jsonb_build_object('received',true,'duplicate',true);end if;
 if d.status='complete' then update colorwin_private.youpi_payments set completed_at=now() where deposit_id=d.id;return jsonb_build_object('received',true,'duplicate',true);end if;
 if d.status not in('to be paid','pending') then raise exception 'Deposit needs manual review';end if;
 perform pg_advisory_xact_lock(hashtextextended(d.user_id::text,94));
 insert into public.account_wallet_ledger(user_id,amount,source,reference) values(d.user_id,d.amount,'deposit','deposit:'||d.id);
 insert into public.promotion_deposits(user_id,payment_reference,amount) values(d.user_id,'deposit:'||d.id,d.amount);
 update public.cw_deposit_requests set status='complete',bank_reference='youpi:'||pid,review_note='Verified YouPI UPI payment',reviewed_at=now() where id=d.id;
 update colorwin_private.youpi_payments set completed_at=now() where deposit_id=d.id;
 insert into public.account_notifications(user_id,kind,title,message) values(d.user_id,'deposit','Deposit successful','Thank you for your deposit! ₹'||to_char(d.amount,'FM999999990.00')||' has been credited to your Color Win wallet.');
 else raise exception 'Unknown gateway operation';end if;
 return jsonb_build_object('received',true);
end $$;
revoke all on function colorwin_private.youpi_backend(text,jsonb) from public,anon,authenticated;
create function public.colorwin_youpi_backend(p_action text,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.youpi_backend(p_action,p_data);$$;
revoke all on function public.colorwin_youpi_backend(text,jsonb) from public,anon,authenticated;
grant execute on function colorwin_private.youpi_backend(text,jsonb),public.colorwin_youpi_backend(text,jsonb) to service_role;
