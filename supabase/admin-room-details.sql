create or replace function colorwin_private.admin_list(p_section text,p_search text,p_page integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=colorwin_private.require_admin('read');rows jsonb;total bigint;tbl text;off integer:=greatest(coalesce(p_page,0),0)*50;begin
 if off>100000 or char_length(coalesce(p_search,''))>100 then raise exception 'Invalid pagination';end if;
 if p_section='overview' then return jsonb_build_object('role',r,'users',(select count(*) from public.profiles),'pending_deposits',(select count(*) from public.cw_deposit_requests where status='pending'),'pending_withdrawals',(select count(*) from public.cw_withdraw_requests where status in ('pending','processing')),'pending_support',(select count(*) from public.support_tickets where status in ('pending','reviewing')),'wallet_total',(select coalesce(sum(amount),0) from public.account_wallet_ledger),'deposits_total',(select coalesce(sum(amount),0) from public.promotion_deposits),'withdrawals_total',(select coalesce(sum(amount),0) from public.cw_withdraw_requests where status='paid'));
 elsif p_section='users' then
  select count(*) into total from public.profiles p where concat_ws(' ',p.phone,p.public_uid,p.display_name) ilike '%'||coalesce(p_search,'')||'%';
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from(select p.*,(select coalesce(sum(amount),0) from public.account_wallet_ledger where user_id=p.id) as balance from public.profiles p where concat_ws(' ',p.phone,p.public_uid,p.display_name) ilike '%'||coalesce(p_search,'')||'%' order by p.created_at desc limit 50 offset off)x;
 elsif p_section='settings' then perform colorwin_private.require_admin('content');return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x)) from colorwin_private.site_settings x),'[]'::jsonb),'total',3);
 elsif p_section='audit' then perform colorwin_private.require_admin('owner');select count(*) into total from colorwin_private.admin_audit;select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from(select * from colorwin_private.admin_audit order by id desc limit 50 offset off)x;
 elsif p_section='admins' then perform colorwin_private.require_admin('owner');return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x)) from(select a.*,p.phone,p.display_name from colorwin_private.admin_members a join public.profiles p on p.id=a.user_id)x),'[]'::jsonb),'total',(select count(*) from colorwin_private.admin_members));
 elsif p_section='gifts' then perform colorwin_private.require_admin('content');select count(*) into total from colorwin_private.gift_codes;select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from(select * from colorwin_private.gift_codes order by created_at desc limit 50 offset off)x;
 elsif p_section='games' then perform colorwin_private.require_admin('content');return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x)) from colorwin_private.game_controls x),'[]'::jsonb),'total',(select count(*) from colorwin_private.game_controls));
 else
  tbl:=case p_section when 'deposits' then 'cw_deposit_requests' when 'withdrawals' then 'cw_withdraw_requests' when 'support' then 'support_tickets' when 'feedback' then 'account_feedback' when 'ledger' then 'account_wallet_ledger' when 'entries' then 'cw_tournament_entries' when 'tournaments' then 'cw_tournaments' when 'announcements' then 'cw_announcements' when 'promotion' then 'cw_promotion_campaigns' else null end;
  if tbl is null then raise exception 'Unknown section';end if;
  perform colorwin_private.require_admin(case when p_section in ('deposits','withdrawals','ledger') then 'finance' when p_section in ('support','feedback') then 'support' when p_section in ('entries','tournaments') then 'tournaments' else 'content' end);
  if p_section='tournaments' then
   select count(*) into total from public.cw_tournaments tm where tm::text ilike '%'||coalesce(p_search,'')||'%';
   select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from(select tm.*,rm.room_id,rm.password as room_password from public.cw_tournaments tm left join colorwin_private.tournament_rooms rm on rm.tournament_id=tm.id where tm::text ilike '%'||coalesce(p_search,'')||'%' order by tm.created_at desc limit 50 offset off)x;
  elsif p_section in ('announcements','promotion') then
   execute format('select count(*) from public.%I t where t::text ilike $1',tbl) into total using '%'||coalesce(p_search,'')||'%';
   execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from(select * from public.%I t where t::text ilike $1 order by created_at desc limit 50 offset $2)x',tbl) into rows using '%'||coalesce(p_search,'')||'%',off;
  else
   execute format('select count(*) from public.%I t join public.profiles p on p.id=t.user_id where concat_ws('' '',t::text,p.phone,p.public_uid) ilike $1',tbl) into total using '%'||coalesce(p_search,'')||'%';
   execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from(select t.*,p.phone,p.public_uid,p.display_name from public.%I t join public.profiles p on p.id=t.user_id where concat_ws('' '',t::text,p.phone,p.public_uid) ilike $1 order by t.created_at desc limit 50 offset $2)x',tbl) into rows using '%'||coalesce(p_search,'')||'%',off;
  end if;
 end if;return jsonb_build_object('rows',rows,'total',total,'role',r);
end $$;
