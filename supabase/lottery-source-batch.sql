create table colorwin_private.lottery_requests(user_id uuid not null references auth.users(id),request_id uuid not null,payload jsonb not null,created_at timestamptz not null default now(),primary key(user_id,request_id));
alter table colorwin_private.lottery_requests enable row level security;
revoke all on colorwin_private.lottery_requests from public,anon,authenticated;
create function colorwin_private.lottery_batch(g text,d jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=colorwin_private.assert_active();req uuid:=(d->>'request_id')::uuid;prior jsonb;canonical jsonb;selections jsonb:=d->'selections';amt numeric:=(d->>'amount')::numeric;s text;r jsonb;idx integer:=0;ids jsonb:='[]';begin
 if req is null or jsonb_typeof(selections) is distinct from 'array' or jsonb_array_length(selections) not between 1 and 64 then raise exception 'Invalid bet selection';end if;
 if (select count(distinct value) from jsonb_array_elements(selections))<>jsonb_array_length(selections) then raise exception 'Duplicate selection';end if;
 if amt is null or amt<1 or amt<>round(amt,2) or amt*jsonb_array_length(selections)>10000 then raise exception 'Bet total must be between 1 and 10000';end if;
 canonical:=jsonb_build_object('game',g,'lane',d->'lane','round',d->'round','amount',amt,'selections',selections);
 perform pg_advisory_xact_lock(hashtextextended(u::text,94));
 select payload into prior from colorwin_private.lottery_requests where user_id=u and request_id=req;
 if found then if prior<>canonical then raise exception 'Request ID already used';end if;return colorwin_private.lottery_action(g,'load',d);end if;
 insert into colorwin_private.lottery_requests values(u,req,canonical,now());
 for s in select value from jsonb_array_elements_text(selections) loop
 idx:=idx+1;
 r:=colorwin_private.lottery_action(g,'bet',jsonb_build_object('lane',d->'lane','round',d->'round','selection',s,'amount',amt,'request_id',md5(req::text||':'||idx)::uuid));
 ids:=ids||jsonb_build_array(r->'accepted_id');
 end loop;
 return r||jsonb_build_object('accepted_ids',ids);
end $$;
revoke all on function colorwin_private.lottery_batch(text,jsonb) from public,anon,authenticated;
grant execute on function colorwin_private.lottery_batch(text,jsonb) to authenticated;
create function public.colorwin_lottery_batch(p_game text,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.lottery_batch(p_game,p_data);$$;
revoke all on function public.colorwin_lottery_batch(text,jsonb) from public,anon;
grant execute on function public.colorwin_lottery_batch(text,jsonb) to authenticated;
