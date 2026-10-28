begin;
alter table public.cw_deposit_requests add column client_request_id uuid not null default gen_random_uuid();
alter table public.cw_withdraw_requests add column client_request_id uuid not null default gen_random_uuid();
create unique index cw_deposit_client_request on public.cw_deposit_requests(user_id,client_request_id);
create unique index cw_withdraw_client_request on public.cw_withdraw_requests(user_id,client_request_id);
create or replace function colorwin_private.wallet_action(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=colorwin_private.assert_active();cfg jsonb;d public.cw_deposit_requests;w public.cw_withdraw_requests;m public.cw_payout_methods;a numeric;bal numeric;input_details jsonb;utr_value text;receiver text;result jsonb;
begin
 select value into cfg from colorwin_private.site_settings where key='payments';
 if p_action='load' then return jsonb_build_object('deposits',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select * from public.cw_deposit_requests where user_id=u order by created_at desc limit 200)x),'[]'::jsonb),'withdrawals',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select * from public.cw_withdraw_requests where user_id=u order by created_at desc limit 200)x),'[]'::jsonb),'methods',coalesce((select jsonb_agg(to_jsonb(x)) from public.cw_payout_methods x where user_id=u and active),'[]'::jsonb),'balance',coalesce((select sum(amount) from public.account_wallet_ledger where user_id=u),0));end if;
 if p_action='create_deposit' then
  if nullif(p_data->>'request_id','') is null then raise exception 'Request id required';end if;
  if not coalesce((cfg->>'enabled')::boolean,false) then raise exception 'Deposits temporarily unavailable';end if;
  a:=(p_data->>'amount')::numeric;if a is null or a<>round(a,2) or a<(cfg->>'minDeposit')::numeric or a>(cfg->>'maxDeposit')::numeric then raise exception 'Deposit amount outside allowed range';end if;
  if p_data->>'method' not in ('upi','innate','paytm') then raise exception 'Unsupported payment method';end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,92));
  select * into d from public.cw_deposit_requests where user_id=u and client_request_id=(p_data->>'request_id')::uuid;if found then if d.amount<>a or d.method<>p_data->>'method' then raise exception 'Request id reused with different details';end if;return to_jsonb(d);end if;
  if (select count(*) from public.cw_deposit_requests where user_id=u and created_at>now()-interval '1 hour')>=20 then raise exception 'Too many deposit orders. Try later';end if;
  select value into receiver from jsonb_array_elements_text(cfg->'upiIds') order by random() limit 1;if receiver is null then raise exception 'Payment receiver unavailable';end if;
  insert into public.cw_deposit_requests(user_id,amount,method,recipient_upi,recipient_name,client_request_id) values(u,a,p_data->>'method',receiver,cfg->>'receiverName',(p_data->>'request_id')::uuid) returning * into d;return to_jsonb(d);
 elsif p_action in ('submit_utr','cancel_deposit') then
  select * into d from public.cw_deposit_requests where id=(p_data->>'id')::uuid and user_id=u for update;if not found then raise exception 'Deposit not found';end if;
  if p_action='submit_utr' then
   utr_value:=p_data->>'utr';if utr_value is null or utr_value !~ '^[0-9]{12}$' then raise exception 'Enter a 12-digit UTR';end if;
   if d.status='pending' and d.utr=utr_value then return to_jsonb(d);end if;
   if d.status<>'to be paid' then raise exception 'This deposit cannot accept a UTR';end if;
   update public.cw_deposit_requests set utr=utr_value,status='pending' where id=d.id returning * into d;
  else
   if d.status<>'to be paid' then raise exception 'Submitted deposits cannot be cancelled';end if;
   update public.cw_deposit_requests set status='cancelled',review_note=left(coalesce(p_data->>'reason','Cancelled by user'),300) where id=d.id returning * into d;
  end if;return to_jsonb(d);
 elsif p_action='save_method' then
  input_details:=p_data->'details';if input_details is null or jsonb_typeof(input_details)<>'object' or octet_length(input_details::text)>2000 then raise exception 'Invalid beneficiary';end if;
  if p_data->>'kind' not in ('upi','bank','usdt') then raise exception 'Invalid beneficiary type';end if;
  if p_data->>'kind'='usdt' then raise exception 'USDT withdrawals are not enabled';end if;
  if coalesce(char_length(input_details->>'name'),0) not between 2 and 100 then raise exception 'Enter beneficiary name';end if;
  if p_data->>'kind'='upi' and coalesce(input_details->>'account','') !~ '^[A-Za-z0-9._-]+@[A-Za-z][A-Za-z0-9.-]+$' then raise exception 'Invalid UPI';end if;
  if p_data->>'kind'='bank' and (coalesce(input_details->>'account','') !~ '^[0-9]{9,18}$' or coalesce(input_details->>'ifsc','') !~ '^[A-Z]{4}0[A-Z0-9]{6}$' or coalesce(char_length(input_details->>'bank'),0)<2) then raise exception 'Invalid bank details';end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,93));
  if exists(select 1 from public.cw_payout_methods where user_id=u and active and details->>'name'<>p_data->'details'->>'name') then raise exception 'Use your original beneficiary name';end if;
  if exists(select 1 from public.cw_payout_methods where user_id=u and active and kind=p_data->>'kind' and lower(details->>'account')=lower(p_data->'details'->>'account')) then raise exception 'Beneficiary already exists';end if;
  if (select count(*) from public.cw_payout_methods where user_id=u and active)>=10 then raise exception 'Beneficiary limit reached';end if;
  insert into public.cw_payout_methods(user_id,kind,details) values(u,p_data->>'kind',input_details) returning * into m;return to_jsonb(m);
 elsif p_action='withdraw' then
  if nullif(p_data->>'request_id','') is null then raise exception 'Request id required';end if;
  a:=(p_data->>'amount')::numeric;if not coalesce((cfg->>'enabled')::boolean,false) or a is null or a<>round(a,2) or a<(cfg->>'minWithdraw')::numeric or a>(cfg->>'maxWithdraw')::numeric then raise exception 'Withdrawal unavailable or amount outside allowed range';end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,94));
  select * into w from public.cw_withdraw_requests where user_id=u and client_request_id=(p_data->>'request_id')::uuid;if found then if w.amount<>a or w.method_id<>(p_data->>'method_id')::uuid then raise exception 'Request id reused with different details';end if;return to_jsonb(w);end if;
  select * into m from public.cw_payout_methods where id=(p_data->>'method_id')::uuid and user_id=u and active for update;if not found or m.kind='usdt' then raise exception 'Select an active INR beneficiary';end if;
  select coalesce(sum(amount),0) into bal from public.account_wallet_ledger where user_id=u;if bal<a then raise exception 'Insufficient withdrawable balance';end if;
  insert into public.cw_withdraw_requests(user_id,amount,method_id,payout_snapshot,client_request_id) values(u,a,m.id,jsonb_build_object('kind',m.kind,'details',m.details),(p_data->>'request_id')::uuid) returning * into w;
  insert into public.account_wallet_ledger(user_id,amount,source,reference) values(u,-a,'withdrawal_reserve','withdraw-reserve:'||w.id);return to_jsonb(w);
 end if;raise exception 'Unknown wallet action';
end $$;

commit;