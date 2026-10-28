alter table public.cw_tournament_entries add column most_kills_reward numeric(14,2) not null default 0 check(most_kills_reward>=0), add column most_kills_paid_at timestamptz;
CREATE OR REPLACE FUNCTION colorwin_private.admin_action_internal(p_action text, p_data jsonb, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d public.cw_deposit_requests;w public.cw_withdraw_requests;s public.support_tickets;t public.cw_tournaments;e public.cw_tournament_entries;m public.cw_payout_methods;before_row jsonb;after_row jsonb;target uuid;v text;a numeric;cfg jsonb;max_rewards numeric;begin
 perform colorwin_private.require_admin('read');if coalesce(char_length(btrim(p_reason)),0) not between 3 and 500 then raise exception 'Enter an audit reason (3–500 characters)';end if;
 if p_action in ('approve_deposit','reject_deposit') then
  perform colorwin_private.require_admin('finance');select * into d from public.cw_deposit_requests where id=(p_data->>'id')::uuid for update;if not found then raise exception 'Deposit not found';end if;before_row:=to_jsonb(d);
  if d.status<>'pending' or d.utr is null then raise exception 'Only pending UTR deposits can be reviewed';end if;
  if p_action='approve_deposit' then
   if coalesce(char_length(btrim(p_data->>'bank_reference')),0) not between 3 and 100 then raise exception 'Bank verification reference required';end if;
   insert into public.account_wallet_ledger(user_id,amount,source,reference) values(d.user_id,d.amount,'deposit','deposit:'||d.id);
   insert into public.promotion_deposits(user_id,payment_reference,amount) values(d.user_id,'deposit:'||d.id,d.amount);
  end if;
  update public.cw_deposit_requests set status=case when p_action='approve_deposit' then 'complete' else 'rejected' end,bank_reference=case when p_action='approve_deposit' then btrim(p_data->>'bank_reference') else null end,review_note=p_reason||coalesce(' · bank ref '||(p_data->>'bank_reference'),''),reviewed_by=auth.uid(),reviewed_at=now() where id=d.id returning to_jsonb(cw_deposit_requests.*) into after_row;
  insert into public.account_notifications(user_id,kind,title,message) values(d.user_id,'deposit',case when p_action='approve_deposit' then 'Deposit successful' else 'Deposit rejected' end,case when p_action='approve_deposit' then 'Thank you for your deposit! ₹'||to_char(d.amount,'FM999999990.00')||' has been credited to your Color Win wallet. Order: '||d.number else 'Your deposit of ₹'||to_char(d.amount,'FM999999990.00')||' was rejected. Please contact customer service if you need help. Order: '||d.number end);
 elsif p_action in ('process_withdrawal','pay_withdrawal','reject_withdrawal') then
  perform colorwin_private.require_admin('finance');select * into w from public.cw_withdraw_requests where id=(p_data->>'id')::uuid for update;if not found then raise exception 'Withdrawal not found';end if;before_row:=to_jsonb(w);
  if w.status not in ('pending','processing') then raise exception 'Withdrawal already finalized';end if;
  if p_action='process_withdrawal' and w.status<>'pending' then raise exception 'Already processing';end if;
  if p_action='pay_withdrawal' then v:=btrim(p_data->>'payout_reference');if coalesce(char_length(v),0) not between 3 and 100 then raise exception 'Actual payout transaction reference required';end if;
  elsif p_action='reject_withdrawal' then insert into public.account_wallet_ledger(user_id,amount,source,reference) values(w.user_id,w.amount,'withdrawal_refund','withdraw-refund:'||w.id);end if;
  update public.cw_withdraw_requests set status=case p_action when 'pay_withdrawal' then 'paid' when 'reject_withdrawal' then 'rejected' else 'processing' end,payout_reference=v,review_note=p_reason,reviewed_by=auth.uid(),reviewed_at=now() where id=w.id returning to_jsonb(cw_withdraw_requests.*) into after_row;
  insert into public.account_notifications(user_id,kind,title,message) values(w.user_id,'withdrawal','Withdrawal update','₹'||w.amount||' · '||(after_row->>'status')||' · '||p_reason);
 elsif p_action='user_update' then
  perform colorwin_private.require_admin('owner');target:=(p_data->>'id')::uuid;select to_jsonb(p) into before_row from public.profiles p where id=target for update;if before_row is null then raise exception 'User not found';end if;
  if exists(select 1 from colorwin_private.admin_members where user_id=target and active) and coalesce((p_data->>'is_blocked')::boolean,false) then raise exception 'Revoke admin access before suspending an admin';end if;
  if p_data ? 'display_name' and char_length(p_data->>'display_name') not between 2 and 30 then raise exception 'Name must be 2–30 characters';end if;
  update public.profiles set display_name=coalesce(p_data->>'display_name',display_name),is_blocked=coalesce((p_data->>'is_blocked')::boolean,is_blocked) where id=target returning to_jsonb(profiles.*) into after_row;
 elsif p_action='wallet_adjustment' then
  perform colorwin_private.require_admin('owner');target:=(p_data->>'user_id')::uuid;a:=(p_data->>'amount')::numeric;if a is null or a=0 or abs(a)>100000 or a<>round(a,2) then raise exception 'Invalid adjustment';end if;
  perform pg_advisory_xact_lock(hashtextextended(target::text,94));
  if not exists(select 1 from public.profiles where id=target) then raise exception 'User not found';end if;
  if coalesce((select sum(amount) from public.account_wallet_ledger where user_id=target),0)+a<0 then raise exception 'Adjustment would create a negative balance';end if;
  insert into public.account_wallet_ledger(user_id,amount,source,reference) values(target,a,'admin_adjustment','adjustment:'||(p_data->>'request_id')::uuid) returning to_jsonb(account_wallet_ledger.*) into after_row;
  insert into public.account_notifications(user_id,kind,title,message) values(target,'account','Wallet adjustment','₹'||a||' · '||p_reason);
 elsif p_action='support_update' then
  perform colorwin_private.require_admin('support');select * into s from public.support_tickets where id=(p_data->>'id')::uuid for update;if not found then raise exception 'Ticket not found';end if;before_row:=to_jsonb(s);
  if s.status in ('resolved','rejected') then raise exception 'Ticket already finalized';end if;
  if p_data->>'status' not in ('reviewing','resolved','rejected') or coalesce(char_length(p_data->>'reply'),0) not between 3 and 2000 then raise exception 'Reply and valid status required';end if;
  if coalesce((p_data->>'apply_change')::boolean,false) then
   if p_data->>'status'<>'resolved' then raise exception 'Resolve ticket to apply verified change';end if;
   if s.category not in ('ifsc','bank-name','bank-rebind','upi-rebind','usdt-rebind') then raise exception 'This category does not support beneficiary changes';end if;
   select * into m from public.cw_payout_methods where user_id=s.user_id and active and details->>'account'=case when s.category like 'bank%' or s.category='ifsc' then s.details->>'bank_number' when s.category='upi-rebind' then s.details->>'upi' else s.details->>'usdt' end for update;
   if not found then raise exception 'Matching active beneficiary not found; verify ticket account';end if;
   if s.category in ('ifsc','bank-name') then
    if m.kind<>'bank' then raise exception 'Ticket must refer to a bank beneficiary';end if;
    update public.cw_payout_methods set details=details||case when s.category='ifsc' then jsonb_build_object('ifsc',s.details->>'ifsc') else jsonb_build_object('bank',s.details->>'bank_name') end where id=m.id;
   else update public.cw_payout_methods set active=false where id=m.id;end if;
  end if;
  update public.support_tickets set status=p_data->>'status',admin_reply=p_data->>'reply',updated_at=now() where id=s.id returning to_jsonb(support_tickets.*) into after_row;
  insert into public.account_notifications(user_id,kind,title,message) values(s.user_id,'account','Support request updated',s.number||' · '||(p_data->>'reply'));
 elsif p_action='feedback_update' then
  perform colorwin_private.require_admin('support');if p_data->>'status' not in ('reviewed','resolved') then raise exception 'Invalid feedback status';end if;
  select to_jsonb(x) into before_row from public.account_feedback x where id=(p_data->>'id')::uuid for update;update public.account_feedback set status=p_data->>'status' where id=(p_data->>'id')::uuid returning to_jsonb(account_feedback.*) into after_row;if after_row is null then raise exception 'Feedback not found';end if;
 elsif p_action='save_tournament' then
  perform colorwin_private.require_admin('tournaments');target:=nullif(p_data->>'id','')::uuid;
  if p_data->>'status' not in ('draft','open','live','completed','cancelled') then raise exception 'Invalid tournament status';end if;
  if target is not null then select * into t from public.cw_tournaments where id=target for update;if not found then raise exception 'Tournament not found';end if;before_row:=to_jsonb(t);if t.status in ('completed','cancelled') then raise exception 'Finalized tournament cannot be edited';end if;end if;
  if p_data->>'banner' !~ '^assets/tournaments/[a-zA-Z0-9_-]+\.png$' then raise exception 'Select a bundled tournament banner';end if;
  if target is null then
   if p_data->>'status' not in ('draft','open') then raise exception 'Create tournament as draft or open';end if;
   insert into public.cw_tournaments(title,game,mode,status,banner,entry_fee,prize_pool,capacity,starts_at,rules) values(p_data->>'title',p_data->>'game',p_data->>'mode',p_data->>'status',p_data->>'banner',(p_data->>'entry_fee')::numeric,(p_data->>'prize_pool')::numeric,(p_data->>'capacity')::integer,(p_data->>'starts_at')::timestamptz,left(coalesce(p_data->>'rules',''),5000)) returning * into t;
  else
   if exists(select 1 from public.cw_tournament_entries where tournament_id=target) and ((p_data->>'entry_fee')::numeric<>t.entry_fee or p_data->>'game'<>t.game or p_data->>'mode'<>t.mode) then raise exception 'Cannot change fees or game after registrations';end if;
   if (p_data->>'capacity')::integer<(select count(*) from public.cw_tournament_entries where tournament_id=target and status<>'cancelled') then raise exception 'Capacity below registered players';end if;
   if p_data->>'status'='cancelled' then
    -- Refund each registration once. No arbitrary deletion of financial history.
    for e in select * from public.cw_tournament_entries where tournament_id=target and status<>'cancelled' for update loop
     if t.entry_fee>0 then insert into public.account_wallet_ledger(user_id,amount,source,reference) values(e.user_id,t.entry_fee,'tournament_refund','tournament-refund:'||e.id);end if;
     update public.cw_tournament_entries set status='cancelled' where id=e.id;
    end loop;
   end if;
   update public.cw_tournaments set title=p_data->>'title',status=p_data->>'status',banner=p_data->>'banner',entry_fee=(p_data->>'entry_fee')::numeric,prize_pool=(p_data->>'prize_pool')::numeric,capacity=(p_data->>'capacity')::integer,starts_at=(p_data->>'starts_at')::timestamptz,rules=left(coalesce(p_data->>'rules',''),5000) where id=target returning * into t;
  end if;
  if p_data ? 'registration_closed' then
   if jsonb_typeof(p_data->'registration_closed') is distinct from 'boolean' then raise exception 'Invalid registration setting';end if;
   update public.cw_tournaments set registration_closed=(p_data->>'registration_closed')::boolean where id=t.id returning * into t;
  end if;
  if p_data ? 'room_link' then
   if length(coalesce(p_data->>'room_link',''))>2000 or (coalesce(p_data->>'room_link','')<>'' and (p_data->>'room_link') !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[^[:space:]<>]*)?$') then raise exception 'Enter a valid HTTPS room invite link';end if;
  end if;
  if coalesce(p_data->>'room_id','')<>'' or p_data ? 'room_link' then
   insert into colorwin_private.tournament_rooms(tournament_id,room_id,password,room_link)
   values(t.id,left(coalesce(p_data->>'room_id',''),100),left(coalesce(p_data->>'room_password',''),100),nullif(p_data->>'room_link',''))
   on conflict(tournament_id) do update set
    room_id=case when excluded.room_id<>'' then excluded.room_id else tournament_rooms.room_id end,
    password=case when excluded.room_id<>'' then excluded.password else tournament_rooms.password end,
    room_link=case when p_data ? 'room_link' then excluded.room_link else tournament_rooms.room_link end;
  end if;after_row:=to_jsonb(t);
 elsif p_action='tournament_result' then
  perform colorwin_private.require_admin('tournaments');select tournament_id into target from public.cw_tournament_entries where id=(p_data->>'id')::uuid;select * into t from public.cw_tournaments where id=target for update;if not found or t.status not in ('live','completed') then raise exception 'Match must be live or completed';end if;
  select * into e from public.cw_tournament_entries where id=(p_data->>'id')::uuid for update;if e.status='cancelled' or e.reward_paid_at is not null then raise exception 'Entry cancelled or reward already finalized';end if;before_row:=to_jsonb(e);a:=(p_data->>'reward')::numeric;
  if a is null or a<0 or a<>round(a,2) or (p_data->>'rank')::integer<=0 then raise exception 'Invalid rank or reward';end if;
  if (p_data->>'rank')::integer in (1,2) and exists(select 1 from public.cw_tournament_entries where tournament_id=target and rank=(p_data->>'rank')::integer and reward_paid_at is not null and id<>e.id) then raise exception 'This prize place has already been awarded';end if;
  select coalesce(sum(case when reward_paid_at is not null then reward else 0 end + case when most_kills_paid_at is not null then most_kills_reward else 0 end),0) into max_rewards from public.cw_tournament_entries where tournament_id=target;if max_rewards+a>t.prize_pool then raise exception 'Rewards exceed tournament prize pool';end if;
  if a>0 then insert into public.account_wallet_ledger(user_id,amount,source,reference) values(e.user_id,a,'tournament_reward','tournament-reward:'||e.id);end if;
  update public.cw_tournament_entries set status='played',rank=(p_data->>'rank')::integer,reward=a,reward_paid_at=now() where id=e.id returning to_jsonb(cw_tournament_entries.*) into after_row;
  insert into public.account_notifications(user_id,kind,title,message) values(e.user_id,'account','Tournament result',t.title||' · rank '||(p_data->>'rank')||' · reward ₹'||a);
 elsif p_action='tournament_most_kills' then
  perform colorwin_private.require_admin('tournaments');
  select tournament_id into target from public.cw_tournament_entries where id=(p_data->>'id')::uuid;
  select * into t from public.cw_tournaments where id=target for update;
  if not found or t.status not in ('live','completed') then raise exception 'Match must be live or completed';end if;
  select * into e from public.cw_tournament_entries where id=(p_data->>'id')::uuid for update;
  if e.status='cancelled' or e.most_kills_paid_at is not null then raise exception 'Entry cancelled or most kills reward already finalized';end if;
  if exists(select 1 from public.cw_tournament_entries where tournament_id=target and most_kills_paid_at is not null) then raise exception 'Most kills reward already awarded for this match';end if;
  before_row:=to_jsonb(e);a:=(p_data->>'reward')::numeric;
  if a is null or a<=0 or a<>round(a,2) then raise exception 'Invalid most kills reward';end if;
  select coalesce(sum(case when reward_paid_at is not null then reward else 0 end + case when most_kills_paid_at is not null then most_kills_reward else 0 end),0) into max_rewards from public.cw_tournament_entries where tournament_id=target;
  if max_rewards+a>t.prize_pool then raise exception 'Rewards exceed tournament prize pool';end if;
  insert into public.account_wallet_ledger(user_id,amount,source,reference) values(e.user_id,a,'tournament_reward','tournament-most-kills:'||e.id);
  update public.cw_tournament_entries set most_kills_reward=a,most_kills_paid_at=now() where id=e.id returning to_jsonb(cw_tournament_entries.*) into after_row;
  insert into public.account_notifications(user_id,kind,title,message) values(e.user_id,'account','Most kills reward',t.title||' · Most kills reward ₹'||a);
 elsif p_action='save_settings' then
  perform colorwin_private.require_admin('content');v:=p_data->>'key';cfg:=p_data->'value';if v not in ('payments','promotion','site') or jsonb_typeof(cfg)<>'object' then raise exception 'Invalid settings';end if;
  if v='payments' then
   perform colorwin_private.require_admin('owner');if jsonb_typeof(cfg->'upiIds')<>'array' or jsonb_array_length(cfg->'upiIds') not between 1 and 30 or char_length(cfg->>'receiverName') not between 2 and 100 or (cfg->>'minDeposit')::numeric<1 or (cfg->>'maxDeposit')::numeric<(cfg->>'minDeposit')::numeric or (cfg->>'minWithdraw')::numeric<1 or (cfg->>'maxWithdraw')::numeric<(cfg->>'minWithdraw')::numeric then raise exception 'Invalid payment limits';end if;
   if exists(select 1 from jsonb_array_elements_text(cfg->'upiIds') x where x !~ '^[A-Za-z0-9._-]+@[A-Za-z][A-Za-z0-9.-]+$') then raise exception 'Invalid UPI receiver';end if;
  end if;
  select value into before_row from colorwin_private.site_settings where key=v;update colorwin_private.site_settings set value=cfg,updated_at=now() where key=v;after_row:=cfg;
 elsif p_action='announcement' then
  perform colorwin_private.require_admin('content');target:=nullif(p_data->>'id','')::uuid;
  if target is null then insert into public.cw_announcements(title,message,active) values(p_data->>'title',p_data->>'message',coalesce((p_data->>'active')::boolean,true)) returning to_jsonb(cw_announcements.*) into after_row;
  else select to_jsonb(x) into before_row from public.cw_announcements x where id=target for update;update public.cw_announcements set title=p_data->>'title',message=p_data->>'message',active=(p_data->>'active')::boolean where id=target returning to_jsonb(cw_announcements.*) into after_row;end if;
 elsif p_action='campaign' then
  perform colorwin_private.require_admin('content');target:=nullif(p_data->>'id','')::uuid;
  if coalesce(p_data->>'banner','')<>'' and p_data->>'banner' !~ '^assets/[A-Za-z0-9/_% .-]+\.(png|jpg|webp)$' then raise exception 'Use a local banner path';end if;
  if target is null then insert into public.cw_promotion_campaigns(title,description,banner,active) values(p_data->>'title',left(coalesce(p_data->>'description',''),5000),coalesce(p_data->>'banner',''),(p_data->>'active')::boolean) returning to_jsonb(cw_promotion_campaigns.*) into after_row;
  else select to_jsonb(x) into before_row from public.cw_promotion_campaigns x where id=target for update;update public.cw_promotion_campaigns set title=p_data->>'title',description=left(coalesce(p_data->>'description',''),5000),banner=coalesce(p_data->>'banner',''),active=(p_data->>'active')::boolean where id=target returning to_jsonb(cw_promotion_campaigns.*) into after_row;end if;
 elsif p_action='gift_create' then
  perform colorwin_private.require_admin('content');v:=upper(replace(gen_random_uuid()::text,'-',''));insert into colorwin_private.gift_codes(code,kind,amount,minimum_deposit,max_claims,expires_at) values(v,p_data->>'kind',(p_data->>'amount')::numeric,coalesce((p_data->>'minimum_deposit')::numeric,0),(p_data->>'max_claims')::integer,(p_data->>'expires_at')::timestamptz) returning to_jsonb(gift_codes.*) into after_row;
 elsif p_action='game_control' then
  perform colorwin_private.require_admin('content');v:=p_data->>'game_id';if v is null or v !~ '^[a-zA-Z0-9_-]{1,100}$' then raise exception 'Invalid game id';end if;select to_jsonb(x) into before_row from colorwin_private.game_controls x where game_id=v;insert into colorwin_private.game_controls values(v,(p_data->>'enabled')::boolean,now()) on conflict(game_id) do update set enabled=excluded.enabled,updated_at=now() returning to_jsonb(game_controls.*) into after_row;
 elsif p_action='admin_access' then
  perform colorwin_private.require_admin('owner');target:=(p_data->>'user_id')::uuid;
  perform pg_advisory_xact_lock(6243981);
  if target=auth.uid() then raise exception 'Cannot change your own admin access';end if;
  select to_jsonb(x) into before_row from colorwin_private.admin_members x where user_id=target;
  insert into colorwin_private.admin_members(user_id,role,active) values(target,p_data->>'role',(p_data->>'active')::boolean) on conflict(user_id) do update set role=excluded.role,active=excluded.active returning to_jsonb(admin_members.*) into after_row;
 else raise exception 'Unknown admin action';end if;
 if after_row is null then raise exception 'Action did not update a record';end if;
 perform colorwin_private.log_admin(p_action,coalesce(p_data->>'id',p_data->>'user_id',p_data->>'key',after_row->>'id'),before_row,after_row,p_reason);return after_row;
end $function$

