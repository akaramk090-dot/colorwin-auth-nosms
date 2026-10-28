begin;
do $$
declare u uuid:=gen_random_uuid(); d1 uuid;d2 uuid;data jsonb; i integer;
 thresholds numeric[]:=array[300,1000,10000,50000,100000,500000,1000000];
 rewards numeric[]:=array[5,18,100,200,400,3000,7000];
 today date:=(now() at time zone 'Asia/Kolkata')::date;
begin
 insert into auth.users(id,email,raw_user_meta_data) values(u,u::text||'@invalid.test','{"phone":"991999888201"}');
 insert into public.cw_deposit_requests(user_id,amount,method,recipient_upi,recipient_name,status,reviewed_at)
 values(u,150,'upi','fixture','fixture','complete',now()) returning id into d1;
 insert into public.cw_deposit_requests(user_id,amount,method,recipient_upi,recipient_name,status,reviewed_at)
 values(u,149,'upi','fixture','fixture','complete',now()) returning id into d2;
 insert into public.cw_deposit_requests(user_id,amount,method,recipient_upi,recipient_name,status,reviewed_at)
 values(u,1000000,'upi','fixture','fixture','pending',now()),(u,1000000,'upi','fixture','fixture','rejected',now()),
 (u,1000000,'upi','fixture','fixture','complete',(today::timestamp at time zone 'Asia/Kolkata')-interval '1 second');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 data:=public.colorwin_attendance();
 if (data->>'approved_today')::numeric<>299 or (data->>'eligible')::boolean then raise exception 'Pending/rejected/previous approvals counted';end if;
 begin perform public.colorwin_attendance(true);raise exception 'Under-threshold accepted';exception when invalid_parameter_value then null;end;
 execute 'reset role';
 for i in 1..7 loop
  -- Simulate previous rewards claimed on earlier calendar days without advancing the server clock.
  update colorwin_private.attendance_claims set claimed_on=today-(8-day) where user_id=u;
  update public.cw_deposit_requests set amount=thresholds[i]/2 where id=d1;
  update public.cw_deposit_requests set amount=thresholds[i]/2-1 where id=d2;
  execute 'set local role authenticated';
  if (public.colorwin_attendance()->>'eligible')::boolean then raise exception 'Day % below threshold accepted',i;end if;
  execute 'reset role';
  update public.cw_deposit_requests set amount=thresholds[i]/2 where id=d2;
  execute 'set local role authenticated';
  data:=public.colorwin_attendance(true);
  if (data->>'claimed_days')::integer<>i then raise exception 'Day % not claimed',i;end if;
  data:=public.colorwin_attendance(true);
  if (data->>'claimed_days')::integer<>i or (data->>'eligible')::boolean then raise exception 'Same-day/duplicate claim advanced day';end if;
  execute 'reset role';
  if (select sum(amount) from public.account_wallet_ledger where user_id=u and source='attendance')<>(select sum(v) from unnest(rewards[1:i]) v) then raise exception 'Wrong or duplicate wallet credit';end if;
 end loop;
 if (select count(*) from colorwin_private.attendance_claims where user_id=u)<>7 then raise exception 'Wrong history';end if;
 perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 execute 'set local role authenticated';
 begin perform public.colorwin_attendance();raise exception 'Unauthenticated call accepted';exception when insufficient_privilege then null;end;
 begin perform count(*) from colorwin_private.attendance_claims;raise exception 'Direct claim access allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';
end $$;
select 'Attendance: all seven thresholds, approved daily sums, duplicate/same-day claims, wallet credits and access checks passed' as result;
rollback;
