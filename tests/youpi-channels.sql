begin;
do $$ declare u uuid:=gen_random_uuid();v_method text;r jsonb;d public.cw_deposit_requests;req uuid;begin
insert into auth.users(id,email,raw_user_meta_data) values(u,u||'@invalid.test','{}');
perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
foreach v_method in array array['upi','innate','paytm'] loop
 req:=gen_random_uuid();execute 'set local role authenticated';
 r:=public.colorwin_youpi_reserve_channel(100,req,v_method);
 if public.colorwin_youpi_reserve_channel(100,req,v_method)->>'id'<>r->>'id' then raise exception 'Retry changed order';end if;
 execute 'reset role';select * into d from public.cw_deposit_requests where id=(r->>'id')::uuid;
 if d.method<>v_method or d.gateway_provider<>'youpi' or d.user_id<>u then raise exception 'Wrong deposit channel or owner';end if;
end loop;
execute 'set local role authenticated';
begin perform public.colorwin_youpi_reserve_channel(100,gen_random_uuid(),'invalid');raise exception 'Invalid channel allowed';exception when raise_exception then if sqlerrm<>'Invalid deposit channel' then raise;end if;end;
execute 'reset role';
if exists(select 1 from public.account_wallet_ledger where user_id=u) then raise exception 'Reserved deposit credited wallet';end if;
end $$;
rollback;
