begin;
do $$declare u uuid:=gen_random_uuid();ln integer;data jsonb;stamp numeric;expected bigint;remaining numeric;begin
 insert into auth.users(id,email,raw_user_meta_data) values(u,u||'@invalid.test','{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 update colorwin_private.lottery_chain_head set checked_at=clock_timestamp() where id;
 foreach ln in array array[60,180,300,600] loop
  data:=public.colorwin_lottery('trx-wingo','load',jsonb_build_object('lane',ln));stamp:=(data->>'server_ms')::numeric/1000;expected:=floor(stamp/ln);remaining:=(data->>'remaining')::numeric;
  if (data->>'round')::bigint<>expected or abs(remaining-((expected+1)*ln-stamp))>0.003 then raise exception 'Clock mismatch for %',ln;end if;
  if remaining<=0 or remaining>ln or data->>'schedule'<>'clock-v1' then raise exception 'Invalid clock response';end if;
  begin
   perform public.colorwin_lottery('trx-wingo','bet',jsonb_build_object('lane',ln,'round',expected-1,'selection','Big','amount',1,'request_id',gen_random_uuid()));
   raise exception 'Stale round accepted';
  exception when raise_exception then if sqlerrm<>'Betting closed. Please use the next round' then raise;end if;end;
 end loop;
end $$;
rollback;
