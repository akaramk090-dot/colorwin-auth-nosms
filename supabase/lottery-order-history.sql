-- Persist source UI order grouping and quantity without changing stake/payout rules.
alter table colorwin_private.lottery_bets
 add column batch_request_id uuid,
 add column unit_amount numeric(14,2),
 add column quantity_known boolean not null default false,
 add column quantity integer not null default 1 check(quantity between 1 and 1000000),
 add constraint lottery_order_request foreign key(user_id,batch_request_id) references colorwin_private.lottery_requests(user_id,request_id),
 add constraint lottery_order_amount check(unit_amount is null or (unit_amount>0 and unit_amount*quantity=stake));
update colorwin_private.lottery_bets set unit_amount=stake;
-- Existing batches have deterministic child request IDs; recover only exact matches.
update colorwin_private.lottery_bets b set batch_request_id=r.request_id
 from colorwin_private.lottery_requests r, lateral jsonb_array_elements(r.payload->'selections') with ordinality as picked(selection,position)
 where b.user_id=r.user_id and b.request_id=md5(r.request_id::text||':'||picked.position)::uuid;
create index lottery_owner_batch on colorwin_private.lottery_bets(user_id,batch_request_id) where batch_request_id is not null;

create or replace function colorwin_private.lottery_batch(g text,d jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=colorwin_private.assert_active();req uuid:=(d->>'request_id')::uuid;prior jsonb;canonical jsonb;selections jsonb:=d->'selections';amt numeric:=(d->>'amount')::numeric;s text;r jsonb;idx integer:=0;ids jsonb:='[]';qty integer:=coalesce((d->>'quantity')::integer,1);unit numeric:=coalesce((d->>'unit_amount')::numeric,amt);begin
 if req is null or jsonb_typeof(selections) is distinct from 'array' or jsonb_array_length(selections) not between 1 and 64 then raise exception 'Invalid bet selection';end if;
 if (select count(distinct value) from jsonb_array_elements(selections))<>jsonb_array_length(selections) then raise exception 'Duplicate selection';end if;
 if amt is null or amt<1 or amt<>round(amt,2) or amt*jsonb_array_length(selections)>10000 then raise exception 'Bet total must be between 1 and 10000';end if;
 if qty not between 1 and 1000000 or unit is null or unit<=0 or unit<>round(unit,2) or unit*qty<>amt then raise exception 'Invalid bet quantity';end if;
 canonical:=jsonb_build_object('game',g,'lane',d->'lane','round',d->'round','amount',amt,'selections',selections);
 if d ? 'quantity' or d ? 'unit_amount' then canonical:=canonical||jsonb_build_object('quantity',qty,'unit_amount',unit);end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,94));
 select payload into prior from colorwin_private.lottery_requests where user_id=u and request_id=req;
 if found then if prior<>canonical then raise exception 'Request ID already used';end if;return colorwin_private.lottery_action(g,'load',d);end if;
 insert into colorwin_private.lottery_requests values(u,req,canonical,now());
 for s in select value from jsonb_array_elements_text(selections) loop
  idx:=idx+1;
  r:=colorwin_private.lottery_action(g,'bet',jsonb_build_object('lane',d->'lane','round',d->'round','selection',s,'amount',amt,'request_id',md5(req::text||':'||idx)::uuid));
  update colorwin_private.lottery_bets set batch_request_id=req,unit_amount=unit,quantity=qty,quantity_known=true where id=(r->>'accepted_id')::uuid and user_id=u;
  ids:=ids||jsonb_build_array(r->'accepted_id');
 end loop;
 return colorwin_private.lottery_action(g,'load',d)||jsonb_build_object('accepted_ids',ids);
end $$;
-- Existing private access checks and grants are preserved by CREATE OR REPLACE.
do $migration$
declare definition text;old_query text:='select id,game,lane,round_index,selection,stake,odds,status,payout,result,created_at from colorwin_private.lottery_bets where user_id=u and game=g order by created_at desc limit 100';
begin
 definition:=pg_get_functiondef('colorwin_private.lottery_action(text,text,jsonb)'::regprocedure);
 if position(old_query in definition)=0 then raise exception 'Expected lottery snapshot query not found';end if;
 definition:=replace(definition,old_query,'select id,game,lane,round_index,selection,stake,odds,status,payout,result,created_at,batch_request_id,unit_amount,quantity,quantity_known from colorwin_private.lottery_bets where user_id=u and game=g and lane=ln and coalesce(batch_request_id,id) in (select coalesce(recent.batch_request_id,recent.id) from colorwin_private.lottery_bets recent where recent.user_id=u and recent.game=g and recent.lane=ln order by recent.created_at desc limit 100)');
 execute definition;
end $migration$;
