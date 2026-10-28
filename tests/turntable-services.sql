begin;
select set_config('cw.test.owner',gen_random_uuid()::text,true),set_config('cw.test.other',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,raw_user_meta_data)
select current_setting('cw.test.owner')::uuid,'authenticated','authenticated','wheel-owner-'||current_setting('cw.test.owner')||'@example.invalid','{}'::jsonb
union all select current_setting('cw.test.other')::uuid,'authenticated','authenticated','wheel-other-'||current_setting('cw.test.other')||'@example.invalid','{}'::jsonb;
select set_config('cw.test.code',(select invitation_code from public.profiles where id=current_setting('cw.test.owner')::uuid),true);
select set_config('request.jwt.claim.sub',current_setting('cw.test.owner'),true);
set local role authenticated;
do $$ declare d jsonb; first jsonb; req uuid:=gen_random_uuid(); begin
 d:=public.colorwin_wheel();
 if d->>'choice' is not null then raise exception 'New account should see boxes';end if;
 d:=public.colorwin_wheel('start',3);
 if (d->>'balance')::numeric<>475 or (d->>'spins')::int<>1 then raise exception 'Starting grant or free spin incorrect';end if;
 d:=public.colorwin_wheel('start',1);
 if (d->>'balance')::numeric<>475 or (d->>'choice')::int<>3 then raise exception 'Duplicate start altered reward';end if;
 first:=public.colorwin_wheel('spin',null,req);
 d:=public.colorwin_wheel('spin',null,req);
 if d->'outcome'<>first->'outcome' or d->>'balance'<>first->>'balance' or jsonb_array_length(d->'records')<>1 then raise exception 'Duplicate spin consumed credit';end if;
 if (d->'outcome'->>'amount')::numeric<>(array[45,40,25,30,35,20,10,20])[(d->'outcome'->>'segment')::int+1] then raise exception 'Prize and segment mismatch';end if;
 begin perform public.colorwin_wheel('spin',null,gen_random_uuid());raise exception 'Unlimited spin allowed';exception when others then if sqlerrm not like '%Invite a friend%' then raise;end if;end;
 if has_table_privilege('authenticated','colorwin_private.wheel_accounts','UPDATE') or has_function_privilege('anon','public.colorwin_wheel(text,integer,uuid)','EXECUTE') then raise exception 'Unsafe privileges';end if;
end $$;
reset role;
insert into auth.users(id,aud,role,email,raw_user_meta_data)
select gen_random_uuid(),'authenticated','authenticated','wheel-friend-'||gen_random_uuid()||'@example.invalid',jsonb_build_object('invitation_code',current_setting('cw.test.code')) from generate_series(1,3);
set local role authenticated;
do $$ declare d jsonb; before_balance numeric; req uuid:=gen_random_uuid(); begin
 d:=public.colorwin_wheel();
 if (d->>'spins')::int<>3 then raise exception 'Registrations did not earn exactly 3 spins';end if;
 for i in 1..3 loop d:=public.colorwin_wheel('spin',null,gen_random_uuid());end loop;
 before_balance:=(d->>'balance')::numeric;
 d:=public.colorwin_wheel('claim',null,req);
 if (d->>'balance')::numeric<>before_balance-500 or (d->>'claimed_count')::int<>1 then raise exception 'Claim or carry balance incorrect';end if;
 d:=public.colorwin_wheel('claim',null,req);
 if (d->>'claimed_count')::int<>1 or (public.colorwin_account_data()->>'balance')::numeric<>500 then raise exception 'Duplicate wallet credit';end if;
 begin perform public.colorwin_wheel('claim',null,gen_random_uuid());raise exception 'Insufficient claim accepted';exception when others then if sqlerrm not like '%Reach ₹500%' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cw.test.other'),true);
do $$ declare d jsonb; begin
 d:=public.colorwin_wheel();
 if d->>'choice' is not null or (d->>'claimed_count')::int<>0 or (public.colorwin_account_data()->>'balance')::numeric<>0 then raise exception 'Cross-account data leak';end if;
end $$;
reset role;
rollback;
select 'PASS: one-time 475 grant, segment awards, spin consumption, registration credits, idempotent 500 claims, wallet carry and account isolation; synthetic fixtures rolled back' as wheel_tests;

