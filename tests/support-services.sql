begin;
insert into auth.users(id,aud,role,email,raw_user_meta_data) values
('00000000-0000-4000-a000-000000000093','authenticated','authenticated','support-test-93@example.invalid','{}'),
('00000000-0000-4000-a000-000000000094','authenticated','authenticated','support-test-94@example.invalid','{}');
insert into public.support_tickets(user_id,category,details) values('00000000-0000-4000-a000-000000000094','game','{"message":"Other account private message"}');
insert into storage.objects(bucket_id,name,metadata) values
('cw_support_files','00000000-0000-4000-a000-000000000093/00000000-0000-4000-a000-000000000093.png','{"mimetype":"image/png","size":100}'),
('cw_support_files','00000000-0000-4000-a000-000000000093/00000000-0000-4000-a000-000000000095.png','{"mimetype":"image/png","size":100}'),
('cw_support_files','00000000-0000-4000-a000-000000000094/00000000-0000-4000-a000-000000000094.png','{"mimetype":"image/png","size":100}');
select set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000000093',true);
set local role authenticated;
do $$declare t jsonb; begin
 if jsonb_array_length(public.colorwin_support_data()->'tickets')<>0 then raise exception 'Other user ticket exposed';end if;
 t:=public.colorwin_support_submit('ifsc','{"ifsc":"SBIN0001234","bank_number":"1234567890"}');
 if t->>'number' not like 'CW%' then raise exception 'Ticket number missing';end if;
 if jsonb_array_length(public.colorwin_support_data()->'tickets')<>1 then raise exception 'Ticket submission failed';end if;
 if (select count(*) from storage.objects where bucket_id='cw_support_files')<>2 then raise exception 'Private file isolation failed';end if;
 if has_table_privilege('authenticated','public.support_tickets','UPDATE') then raise exception 'User can edit admin response';end if;
 begin perform public.colorwin_support_submit('ifsc','{"ifsc":"BAD","bank_number":"1234567890"}');raise exception 'Invalid IFSC accepted';exception when others then if sqlerrm not like '%Invalid IFSC%' then raise;end if;end;
 begin perform public.colorwin_support_submit('game','{"message":"A game test issue","password":"do-not-store"}');raise exception 'Password accepted';exception when others then if sqlerrm not like '%Unsupported request field%' then raise;end if;end;
 begin perform public.colorwin_support_submit('game','{"message":"A game test issue"}','[{"path":"00000000-0000-4000-a000-000000000094/00000000-0000-4000-a000-000000000094.png","label":"screenshot","name":"foreign.png"}]');raise exception 'Foreign file accepted';exception when others then if sqlerrm not like '%Invalid attachment%' then raise;end if;end;
 begin perform public.colorwin_support_submit('deposit','{"message":"A missing deposit issue","order_number":"TEST-ORDER","utr":"TEST-UTR"}');raise exception 'Missing proof accepted';exception when others then if sqlerrm not like '%Required proof is missing%' then raise;end if;end;
 begin perform public.colorwin_support_submit('game','{"message":"A game test issue"}');raise exception 'Cooldown failed';exception when others then if sqlerrm not like '%wait a minute%' then raise;end if;end;
end $$;
reset role;
rollback;
-- Storage deletions require the Storage API; direct SQL deletion is prohibited.
select 'PASS: ticket submission, ticket/file isolation, validation, password rejection and cooldown; all fixtures rolled back' as support_services;
