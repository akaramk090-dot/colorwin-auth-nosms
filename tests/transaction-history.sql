begin;
do $$declare u uuid:=gen_random_uuid();other_user uuid:=gen_random_uuid();data jsonb;page2 jsonb;begin
 insert into auth.users(id,email,raw_user_meta_data) values(u,u::text||'@invalid.test','{"phone":"991999887401"}'),(other_user,other_user::text||'@invalid.test','{"phone":"991999887402"}');
 insert into public.account_wallet_ledger(user_id,amount,source,reference,created_at) values
 (u,100,'deposit','fixture:'||u||':1','2026-10-06 18:29:59+00'),
 (u,5,'attendance','fixture:'||u||':2','2026-10-06 18:30:00+00'),
 (u,-20,'withdrawal_reserve','fixture:'||u||':3','2026-10-06 19:00:00+00'),
 (other_user,9999,'deposit','fixture:'||other_user,'2026-10-06 19:00:00+00');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);execute 'set local role authenticated';
 data:=public.colorwin_transaction_history();
 if jsonb_array_length(data->'rows')<>3 or (data->>'balance')::numeric<>85 then raise exception 'Ledger/account isolation failed';end if;
 if (data->'rows'->0->>'balance_after')::numeric<>85 then raise exception 'Balance after debit wrong';end if;
 data:=public.colorwin_transaction_history('attendance');
 if jsonb_array_length(data->'rows')<>1 or (data->'rows'->0->>'balance_after')::numeric<>105 then raise exception 'Filtered balance incorrectly excludes other transaction types';end if;
 data:=public.colorwin_transaction_history('all','2026-10-07');
 if jsonb_array_length(data->'rows')<>2 then raise exception 'IST date boundary wrong';end if;
 if jsonb_array_length(public.colorwin_transaction_history('debit')->'rows')<>1 then raise exception 'Debit filter wrong';end if;
 execute 'reset role';
 insert into public.account_wallet_ledger(user_id,amount,source,reference,created_at)
 select u,1,'gift','fixture:'||u||':bulk:'||i,'2026-10-01 00:00:00+00'::timestamptz+i*interval '1 second' from generate_series(1,110) i;
 execute 'set local role authenticated';data:=public.colorwin_transaction_history();page2:=public.colorwin_transaction_history('all',null,data->'cursor');
 if jsonb_array_length(data->'rows')<>100 or not (data->>'has_more')::boolean or jsonb_array_length(page2->'rows')<>13 or (page2->>'has_more')::boolean then raise exception 'Pagination incomplete';end if;
 if exists(select 1 from jsonb_array_elements(data->'rows') a join jsonb_array_elements(page2->'rows') b on a->>'id'=b->>'id') then raise exception 'Pagination duplicates';end if;
 execute 'reset role';perform set_config('request.jwt.claims','{"role":"authenticated"}',true);execute 'set local role authenticated';
 begin perform public.colorwin_transaction_history();raise exception 'Anonymous history exposed';exception when insufficient_privilege then null;end;
 execute 'reset role';
end $$;
select 'Ledger history: account isolation, correct running balances, type/IST date filters and complete cursor pagination passed' as result;
rollback;
