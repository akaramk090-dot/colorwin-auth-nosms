begin;
alter table public.cw_tournaments add constraint cw_tournament_fee_limit check(entry_fee between 0 and 100000),add constraint cw_tournament_prize_limit check(prize_pool between 0 and 10000000);
-- Require actual booleans and complete limit settings, including SQL NULL handling.
create function colorwin_private.validate_site_settings() returns trigger language plpgsql set search_path='' as $$
declare c jsonb:=new.value;begin
 if new.key='payments' then
  if not(c ?& array['enabled','receiverName','upiIds','minDeposit','maxDeposit','minWithdraw','maxWithdraw']) or jsonb_typeof(c->'enabled') is distinct from 'boolean' or coalesce((c->>'minDeposit')::numeric,0)<1 or coalesce((c->>'maxDeposit')::numeric,0) not between (c->>'minDeposit')::numeric and 1000000 or coalesce((c->>'minWithdraw')::numeric,0)<1 or coalesce((c->>'maxWithdraw')::numeric,0) not between (c->>'minWithdraw')::numeric and 1000000 then raise exception 'Complete valid payment settings required';end if;
 elsif new.key='site' then
  if jsonb_typeof(c->'maintenance') is distinct from 'boolean' or jsonb_typeof(c->'supportEnabled') is distinct from 'boolean' or jsonb_typeof(c->'tournamentsEnabled') is distinct from 'boolean' then raise exception 'Site settings must be booleans';end if;
 elsif new.key='promotion' then
  if jsonb_typeof(c->'enabled') is distinct from 'boolean' or coalesce(c->>'telegram','') !~ '^https://t\.me/[A-Za-z0-9_+/-]*$' then raise exception 'Use an official Telegram HTTPS link';end if;
 end if;return new;end $$;
revoke all on function colorwin_private.validate_site_settings() from public,anon,authenticated;
create trigger validate_cw_site_settings before insert or update on colorwin_private.site_settings for each row execute function colorwin_private.validate_site_settings();
update colorwin_private.site_settings set value=jsonb_set(value,'{telegram}','"https://t.me/+7nI6oZj0wttkYzRl"'::jsonb) where key='promotion';
-- Gate existing services for suspended accounts and configured support availability.
create function colorwin_private.guard_support_submit() returns trigger language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is not null then
  perform colorwin_private.assert_active();
  if not coalesce((select (value->>'supportEnabled')::boolean from colorwin_private.site_settings where key='site'),false) then raise exception 'New support requests temporarily unavailable';end if;
 end if;return new;end $$;
revoke all on function colorwin_private.guard_support_submit() from public,anon,authenticated;
create trigger cw_support_available before insert on public.support_tickets for each row execute function colorwin_private.guard_support_submit();
commit;
