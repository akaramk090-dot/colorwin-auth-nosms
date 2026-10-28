create or replace function colorwin_private.youpi_order(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=colorwin_private.assert_active();d public.cw_deposit_requests;y colorwin_private.youpi_payments;begin
 select * into d from public.cw_deposit_requests where id=p_id and user_id=u and gateway_provider='youpi';
 if not found then raise exception 'Payment order not found';end if;
 select * into y from colorwin_private.youpi_payments where deposit_id=d.id;
 return jsonb_build_object('deposit',to_jsonb(d),'payment_id',y.payment_id);
end $$;
revoke all on function colorwin_private.youpi_order(uuid) from public,anon;
grant execute on function colorwin_private.youpi_order(uuid) to authenticated;
create or replace function public.colorwin_youpi_order(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.youpi_order(p_id);$$;
revoke all on function public.colorwin_youpi_order(uuid) from public,anon;
grant execute on function public.colorwin_youpi_order(uuid) to authenticated;
create or replace function colorwin_private.youpi_checkout_sync(p_id uuid,p_payment uuid,p_upi text,p_name text,p_expires timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.cw_deposit_requests;begin
 select * into d from public.cw_deposit_requests where id=p_id and gateway_provider='youpi' for update;
 if not found or not exists(select 1 from colorwin_private.youpi_payments where deposit_id=p_id and payment_id=p_payment) then raise exception 'Payment identity mismatch';end if;
 if p_upi is null or length(p_upi)>200 or position('@' in p_upi)=0 then raise exception 'Invalid receiver';end if;
 update public.cw_deposit_requests set recipient_upi=p_upi,recipient_name=coalesce(p_name,'Color Win'),expires_at=coalesce(p_expires,expires_at) where id=p_id;
 select * into d from public.cw_deposit_requests where id=p_id;
 return to_jsonb(d);
end $$;
revoke all on function colorwin_private.youpi_checkout_sync(uuid,uuid,text,text,timestamptz) from public,anon,authenticated;
create or replace function public.colorwin_youpi_checkout_sync(p_id uuid,p_payment uuid,p_upi text,p_name text,p_expires timestamptz) returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.youpi_checkout_sync(p_id,p_payment,p_upi,p_name,p_expires);$$;
revoke all on function public.colorwin_youpi_checkout_sync(uuid,uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function colorwin_private.youpi_checkout_sync(uuid,uuid,text,text,timestamptz),public.colorwin_youpi_checkout_sync(uuid,uuid,text,text,timestamptz) to service_role;
