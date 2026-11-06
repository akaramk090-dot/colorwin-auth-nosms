begin;
do $$
declare owner_id uuid:=gen_random_uuid(); outsiders uuid:=gen_random_uuid(); ids uuid[]:='{}'; parent_id uuid; member_id uuid; invitation text; i integer; g text; report jsonb; d date:=(now() at time zone 'Asia/Kolkata')::date; starts timestamptz; uid text; ledger_count bigint;
begin
 starts:=d::timestamp at time zone 'Asia/Kolkata';
 insert into auth.users(id,email,raw_user_meta_data) values(owner_id,owner_id||'@invalid.test','{}'),(outsiders,outsiders||'@invalid.test','{}');
 parent_id:=owner_id;
 for i in 1..7 loop
  member_id:=gen_random_uuid();ids:=array_append(ids,member_id);select invitation_code into invitation from public.profiles where id=parent_id;
  insert into auth.users(id,email,raw_user_meta_data) values(member_id,member_id||'@invalid.test',jsonb_build_object('invitation_code',invitation));parent_id:=member_id;
 end loop;
 update public.profiles set created_at=starts-interval '30 days' where id=any(ids);
 insert into public.promotion_deposits(user_id,payment_reference,amount,completed_at) values(ids[1],gen_random_uuid()::text,99,starts-interval '1 second'),(ids[1],gen_random_uuid()::text,100,starts+interval '5 minutes'),(ids[2],gen_random_uuid()::text,200,starts+interval '6 minutes'),(ids[6],gen_random_uuid()::text,50,starts+interval '7 minutes'),(ids[7],gen_random_uuid()::text,999,starts+interval '8 minutes'),(outsiders,gen_random_uuid()::text,888,starts+interval '8 minutes');
 insert into colorwin_private.wingo_bets(user_id,request_id,lane,round_index,selection,stake,status,created_at) values(ids[1],gen_random_uuid(),30,1,'Big',10,'lost',starts+interval '1 hour'),(ids[2],gen_random_uuid(),30,1,'Big',15,'won',starts+interval '1 hour'),(ids[1],gen_random_uuid(),30,1,'Small',500,'lost',starts-interval '1 second'),(outsiders,gen_random_uuid(),30,1,'Big',999,'lost',starts+interval '1 hour');
 i:=0;foreach g in array array['k3','5d','trx-wingo'] loop
  i:=i+1;insert into colorwin_private.lottery_bets(user_id,request_id,game,lane,round_index,selection,stake,odds,status,created_at) values(ids[2],gen_random_uuid(),g,60,1,'Big',10+i*2,2,'lost',starts+interval '1 hour');
 end loop;
 insert into colorwin_private.arcade_bets(user_id,request_id,game,amount,status,created_at) values(ids[1],gen_random_uuid(),'aviator',20,'lost',starts+interval '1 hour'),(ids[1],gen_random_uuid(),'aviator',999,'cancelled',starts+interval '1 hour');
 insert into colorwin_private.mines_rounds(user_id,request_id,bet,mine_count,mines,status,created_at) values(ids[6],gen_random_uuid(),7,1,array[0],'lost',starts+interval '1 hour');
 select count(*) into ledger_count from public.account_wallet_ledger;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);execute 'set local role authenticated';
 report:=public.colorwin_promotion_report(d);
 if (report->>'total')::int<>6 or (report#>>'{summary,deposit_count}')::int<>3 or (report#>>'{summary,deposit_amount}')::numeric<>350 or (report#>>'{summary,bet_amount}')::numeric<>94 or (report#>>'{summary,bettors}')::int<>3 or (report#>>'{summary,bet_count}')::int<>7 or (report#>>'{summary,first_deposits}')::int<>2 or (report#>>'{summary,first_deposit_amount}')::numeric<>250 then raise exception 'Daily totals mismatch: %',report;end if;
 if exists(select 1 from jsonb_array_elements(report->'members') m where m ? 'phone' or m ? 'id' or m->>'commission' is not null) then raise exception 'Private fields or unconfigured commission exposed';end if;
 report:=public.colorwin_promotion_report(d,1);if (report->>'total')::int<>1 or (report#>>'{summary,bet_amount}')::numeric<>30 then raise exception 'Tier filter incorrect';end if;
 execute 'reset role';select public_uid::text into uid from public.profiles where id=ids[2];execute 'set local role authenticated';
 report:=public.colorwin_promotion_report(d,0,uid);if (report->>'total')::int<>1 or (report#>>'{summary,bet_amount}')::numeric<>57 then raise exception 'UID search incorrect';end if;
 begin perform public.colorwin_promotion_report(d,7);raise exception 'Accepted bad tier';exception when raise_exception then if sqlerrm<>'Invalid report filters' then raise;end if;end;
 begin perform public.colorwin_promotion_report(d,0,'x');raise exception 'Accepted bad UID';exception when raise_exception then if sqlerrm<>'Enter a valid subordinate UID' then raise;end if;end;
 execute 'reset role';
 select invitation_code into invitation from public.profiles where id=owner_id;
 for i in 1..23 loop member_id:=gen_random_uuid();insert into auth.users(id,email,raw_user_meta_data) values(member_id,member_id||'@invalid.test',jsonb_build_object('invitation_code',invitation));end loop;
 execute 'set local role authenticated';report:=public.colorwin_promotion_report(d,0,'',2);if jsonb_array_length(report->'members')<>9 or (report->>'total')::int<>29 or (report->>'has_more')::boolean then raise exception 'Pagination incorrect';end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsiders,'role','authenticated')::text,true);execute 'set local role authenticated';report:=public.colorwin_promotion_report(d);if (report->>'total')::int<>0 then raise exception 'Foreign team exposed';end if;execute 'reset role';
 if (select count(*) from public.account_wallet_ledger)<>ledger_count then raise exception 'Reporting changed a wallet';end if;
 if has_function_privilege('anon','public.colorwin_promotion_report(date,integer,text,integer)','execute') then raise exception 'Anonymous access allowed';end if;
end $$;
rollback;
