begin;
create table public.support_tickets (
 id uuid primary key default gen_random_uuid(),
 number text not null unique default ('CW'||upper(replace(gen_random_uuid()::text,'-',''))),
 user_id uuid not null references auth.users(id) on delete cascade,
 category text not null check(category in ('deposit','withdrawal','ifsc','bank-name','bank-rebind','upi-rebind','usdt-rebind','password','game')),
 details jsonb not null check(jsonb_typeof(details)='object'),
 attachments jsonb not null default '[]'::jsonb check(jsonb_typeof(attachments)='array'),
 status text not null default 'pending' check(status in ('pending','reviewing','resolved','rejected')),
 admin_reply text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index support_tickets_owner_created on public.support_tickets(user_id,created_at desc);
alter table public.support_tickets enable row level security;
revoke all on public.support_tickets from public,anon,authenticated;
grant select on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;
create policy support_read_own on public.support_tickets for select to authenticated using ((select auth.uid())=user_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('cw_support_files','cw_support_files',false,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/x-msvideo','video/x-matroska','video/x-ms-wmv'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy support_file_insert on storage.objects for insert to authenticated with check(bucket_id='cw_support_files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy support_file_read on storage.objects for select to authenticated using(bucket_id='cw_support_files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy support_file_remove_unsubmitted on storage.objects for delete to authenticated using(bucket_id='cw_support_files' and (storage.foldername(name))[1]=(select auth.uid())::text and not exists(select 1 from public.support_tickets t where t.user_id=(select auth.uid()) and t.attachments @> jsonb_build_array(jsonb_build_object('path',name))));

create or replace function public.colorwin_support_submit(p_category text,p_details jsonb,p_attachments jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); a jsonb; k text; v jsonb; required_labels text[]:='{}'; new_ticket public.support_tickets;
begin
 if u is null then raise exception 'Sign in to submit a support request';end if;
 if p_category not in ('deposit','withdrawal','ifsc','bank-name','bank-rebind','upi-rebind','usdt-rebind','password','game') then raise exception 'Unknown support category';end if;
 if p_details is null or jsonb_typeof(p_details)<>'object' or octet_length(p_details::text)>6000 then raise exception 'Invalid request details';end if;
 for k,v in select * from jsonb_each(p_details) loop
  if k not in ('order_number','utr','ifsc','bank_number','bank_name','upi','usdt','message','verification_method') or jsonb_typeof(v)<>'string' or char_length(v#>>'{}')>500 then raise exception 'Unsupported request field';end if;
 end loop;
 if p_category in ('deposit','withdrawal') and coalesce(char_length(btrim(p_details->>'order_number')),0) not between 1 and 100 then raise exception 'Enter the order number';end if;
 if p_category='deposit' and coalesce(char_length(btrim(p_details->>'utr')),0) not between 1 and 100 then raise exception 'Enter the transfer reference';end if;
 if p_category in ('ifsc','bank-name','bank-rebind') and coalesce(p_details->>'bank_number','') !~ '^[0-9]{6,30}$' then raise exception 'Invalid bank account number';end if;
 if p_category='ifsc' and coalesce(p_details->>'ifsc','') !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then raise exception 'Invalid IFSC code';end if;
 if p_category='bank-name' and coalesce(char_length(btrim(p_details->>'bank_name')),0) not between 2 and 100 then raise exception 'Choose the bank name';end if;
 if p_category='upi-rebind' and coalesce(p_details->>'upi','') !~ '^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$' then raise exception 'Invalid UPI ID';end if;
 if p_category='usdt-rebind' and coalesce(p_details->>'usdt','') !~ '^T[1-9A-HJ-NP-Za-km-z]{33}$' then raise exception 'Invalid TRC20 address';end if;
 if p_category not in ('ifsc','bank-name') and coalesce(char_length(btrim(p_details->>'message')),0) not between 10 and 500 then raise exception 'Describe the issue in 10–500 characters';end if;
 if p_attachments is null or jsonb_typeof(p_attachments)<>'array' then raise exception 'Invalid attachments';end if;
 if jsonb_array_length(p_attachments)>5 or octet_length(p_attachments::text)>5000 then raise exception 'Too many attachments';end if;
 for a in select * from jsonb_array_elements(p_attachments) loop
  if jsonb_typeof(a)<>'object' or coalesce(a->>'path','') !~ ('^'||u::text||'/[0-9a-f-]{36}\.(jpg|png|webp|mp4|mov|avi|mkv|wmv)$') or coalesce(a->>'label','') not in ('receipt','identity','passbook','screenshot','video') or coalesce(char_length(a->>'name'),0) not between 1 and 200 then raise exception 'Invalid attachment';end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='cw_support_files' and o.name=a->>'path') then raise exception 'Attachment has not been uploaded';end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='cw_support_files' and o.name=a->>'path' and case when a->>'label'='video' then o.metadata->>'mimetype' in ('video/mp4','video/quicktime','video/x-msvideo','video/x-matroska','video/x-ms-wmv') and (o.metadata->>'size')::bigint between 1 and 52428800 else o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp') and (o.metadata->>'size')::bigint between 1 and 10485760 end) then raise exception 'Unsupported attachment type or size';end if;
 end loop;
 if p_category='deposit' then required_labels:=array['receipt'];end if;
 if p_category in ('bank-rebind','password') then required_labels:=array['identity','passbook','receipt'];end if;
 if p_category in ('upi-rebind','usdt-rebind') then required_labels:=array['identity','receipt'];end if;
 foreach k in array required_labels loop
  if not exists(select 1 from jsonb_array_elements(p_attachments) f where f->>'label'=k and f->>'path' ~ '\.(jpg|png|webp)$') then raise exception 'Required proof is missing: %',k;end if;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended(u::text,81));
 if exists(select 1 from public.support_tickets where user_id=u and created_at>now()-interval '1 minute') then raise exception 'Please wait a minute before sending another request';end if;
 insert into public.support_tickets(user_id,category,details,attachments) values(u,p_category,p_details,p_attachments) returning * into new_ticket;
 return jsonb_build_object('id',new_ticket.id,'number',new_ticket.number);
end $$;
revoke all on function public.colorwin_support_submit(text,jsonb,jsonb) from public,anon;
grant execute on function public.colorwin_support_submit(text,jsonb,jsonb) to authenticated;

create or replace function public.colorwin_support_data()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();result jsonb;
begin
 if u is null then raise exception 'Sign in to view support requests';end if;
 select jsonb_build_object(
  'tickets',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from (select id,number,category,details,attachments,status,admin_reply,created_at,updated_at from public.support_tickets where user_id=u order by created_at desc limit 100) t),'[]'::jsonb),
  'deposits',coalesce((select jsonb_agg(to_jsonb(d) order by d.completed_at desc) from (select id,payment_reference,amount,completed_at from public.promotion_deposits where user_id=u order by completed_at desc limit 100) d),'[]'::jsonb)
 ) into result;return result;
end $$;
revoke all on function public.colorwin_support_data() from public,anon;
grant execute on function public.colorwin_support_data() to authenticated;
commit;
