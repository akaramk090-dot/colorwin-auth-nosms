begin;
do $$declare u uuid:=gen_random_uuid();other_user uuid:=gen_random_uuid();pending_id uuid:=gen_random_uuid();unpaid_id uuid:=gen_random_uuid();cancelled_id uuid:=gen_random_uuid();complete_id uuid:=gen_random_uuid();foreign_id uuid:=gen_random_uuid();data jsonb;args jsonb;id uuid;begin
 insert into auth.users(id,email,raw_user_meta_data) values(u,u||'@invalid.test','{}'),(other_user,other_user||'@invalid.test','{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 insert into public.cw_deposit_requests(id,user_id,amount,method,recipient_upi,recipient_name,status) values(pending_id,u,100,'upi','test@example','Test','pending'),(unpaid_id,u,200,'upi','test@example','Test','to be paid'),(cancelled_id,u,300,'upi','test@example','Test','cancelled'),(complete_id,u,400,'upi','test@example','Test','complete'),(foreign_id,other_user,500,'upi','test@example','Test','pending');
 data:=public.colorwin_support_data();
 if exists(select 1 from jsonb_array_elements(data->'deposits')x where x->>'recipient_upi'<>'test@example') then raise exception 'Receiver UPI not provided';end if;
 if jsonb_array_length(data->'deposits')<>3 or exists(select 1 from jsonb_array_elements(data->'deposits')x where x->>'id' in(complete_id::text,foreign_id::text)) then raise exception 'Deposit eligibility or ownership leak';end if;
 args:=jsonb_build_object('utr','123456789012','receiver_upi','tampered@upi','amount','999999','order_number','tampered');
 begin perform public.colorwin_support_submit('deposit',args||jsonb_build_object('deposit_id',complete_id::text),'[]');raise exception 'Completed order accepted';exception when raise_exception then if sqlerrm<>'This deposit is not eligible for a missing-deposit request' then raise;end if;end;
 begin perform public.colorwin_support_submit('deposit',args||jsonb_build_object('deposit_id',foreign_id::text),'[]');raise exception 'Foreign order accepted';exception when raise_exception then if sqlerrm<>'Select your deposit order' then raise;end if;end;
 foreach id in array array[pending_id,unpaid_id,cancelled_id] loop
  begin perform public.colorwin_support_submit('deposit',args||jsonb_build_object('deposit_id',id::text),'[]');raise exception 'Missing receipt accepted';exception when raise_exception then if sqlerrm<>'Required proof is missing: receipt' then raise;end if;end;
 end loop;
 if has_function_privilege('anon','public.colorwin_support_submit(text,jsonb,jsonb)','execute') then raise exception 'Anonymous submission allowed';end if;
 if not exists(select 1 from storage.buckets bucket where bucket.id='cw_support_files' and not public and file_size_limit=52428800 and 'application/pdf'=any(allowed_mime_types)) then raise exception 'Private proof bucket configuration incorrect';end if;
end $$;
rollback;
