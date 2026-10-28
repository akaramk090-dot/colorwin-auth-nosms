create or replace function colorwin_private.youpi_reserve_channel(p_amount numeric,p_request uuid,p_method text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=colorwin_private.assert_active();d public.cw_deposit_requests;r jsonb;begin
 if p_method is null or p_method not in('upi','innate','paytm') then raise exception 'Invalid deposit channel';end if;
 r:=colorwin_private.wallet_action('create_deposit',jsonb_build_object('amount',p_amount,'method',p_method,'request_id',p_request));
 select * into d from public.cw_deposit_requests where id=(r->>'id')::uuid and user_id=u for update;
 if d.status<>'to be paid' then raise exception 'Create a new payment order';end if;
 if not exists(select 1 from colorwin_private.youpi_payments where deposit_id=d.id) then
 if d.utr is not null then raise exception 'Order already submitted';end if;
 insert into colorwin_private.youpi_payments(deposit_id) values(d.id);
 update public.cw_deposit_requests set gateway_provider='youpi' where id=d.id;end if;
 return jsonb_build_object('id',d.id,'number',d.number,'amount',d.amount);
end $$;
revoke all on function colorwin_private.youpi_reserve_channel(numeric,uuid,text) from public,anon;
grant execute on function colorwin_private.youpi_reserve_channel(numeric,uuid,text) to authenticated;
create or replace function public.colorwin_youpi_reserve_channel(p_amount numeric,p_request uuid,p_method text) returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.youpi_reserve_channel(p_amount,p_request,p_method);$$;
revoke all on function public.colorwin_youpi_reserve_channel(numeric,uuid,text) from public,anon;
grant execute on function public.colorwin_youpi_reserve_channel(numeric,uuid,text) to authenticated;
