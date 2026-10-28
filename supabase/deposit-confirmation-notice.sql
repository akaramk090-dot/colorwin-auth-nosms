begin;
do $migration$
declare definition text;old_notice text:=$old$insert into public.account_notifications(user_id,kind,title,message) values(d.user_id,'deposit',case when p_action='approve_deposit' then 'Deposit approved' else 'Deposit rejected' end,'₹'||d.amount||' · '||p_reason);$old$;
new_notice text:=$new$insert into public.account_notifications(user_id,kind,title,message) values(d.user_id,'deposit',case when p_action='approve_deposit' then 'Deposit successful' else 'Deposit rejected' end,case when p_action='approve_deposit' then 'Thank you for your deposit! ₹'||to_char(d.amount,'FM999999990.00')||' has been credited to your Color Win wallet. Order: '||d.number else 'Your deposit of ₹'||to_char(d.amount,'FM999999990.00')||' was rejected. Please contact customer service if you need help. Order: '||d.number end);$new$;
begin
 select pg_get_functiondef('colorwin_private.admin_action_internal(text,jsonb,text)'::regprocedure) into definition;
 if position(old_notice in definition)>0 then execute replace(definition,old_notice,new_notice);
 elsif position(new_notice in definition)=0 then raise exception 'Expected deposit notification statement not found';end if;
end $migration$;
commit;
