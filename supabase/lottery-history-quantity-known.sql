-- Old orders did not store the original quantity; do not invent it.
alter table colorwin_private.lottery_bets add column quantity_known boolean not null default false;
update colorwin_private.lottery_bets b set quantity_known=true from colorwin_private.lottery_requests r where r.user_id=b.user_id and r.request_id=b.batch_request_id and r.payload ? 'quantity';
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('colorwin_private.lottery_batch(text,jsonb)'::regprocedure);
 if position('unit_amount=unit,quantity=qty where' in definition)=0 then raise exception 'Expected metadata update missing';end if;
 execute replace(definition,'unit_amount=unit,quantity=qty where','unit_amount=unit,quantity=qty,quantity_known=true where');
 definition:=pg_get_functiondef('colorwin_private.lottery_action(text,text,jsonb)'::regprocedure);
 if position('created_at,batch_request_id,unit_amount,quantity from' in definition)=0 then raise exception 'Expected history query missing';end if;
 execute replace(definition,'created_at,batch_request_id,unit_amount,quantity from','created_at,batch_request_id,unit_amount,quantity,quantity_known from');
end $migration$;
