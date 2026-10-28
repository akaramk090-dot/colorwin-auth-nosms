begin;
create function colorwin_private.guard_member_write() returns trigger language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is not null then perform colorwin_private.assert_active();end if;return new;
end $$;
revoke all on function colorwin_private.guard_member_write() from public,anon,authenticated;
create trigger cw_active_feedback before insert on public.account_feedback for each row execute function colorwin_private.guard_member_write();
create trigger cw_active_gift_claim before insert on public.account_gift_claims for each row execute function colorwin_private.guard_member_write();
create function colorwin_private.guard_financial_service() returns trigger language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is not null and coalesce((select (value->>'maintenance')::boolean from colorwin_private.site_settings where key='site'),false) then raise exception 'New financial requests paused during maintenance';end if;return new;
end $$;
revoke all on function colorwin_private.guard_financial_service() from public,anon,authenticated;
create trigger cw_maintenance_deposit before insert on public.cw_deposit_requests for each row execute function colorwin_private.guard_financial_service();
create trigger cw_maintenance_withdraw before insert on public.cw_withdraw_requests for each row execute function colorwin_private.guard_financial_service();
create trigger cw_maintenance_entry before insert on public.cw_tournament_entries for each row execute function colorwin_private.guard_financial_service();
-- Reject missing result rank at the database boundary.
alter table public.cw_tournament_entries add constraint cw_result_rank_required check(status<>'played' or rank is not null);
create index cw_entries_tournament_reward on public.cw_tournament_entries(tournament_id,reward_paid_at);
create index cw_admin_audit_created on colorwin_private.admin_audit(created_at desc);
commit;
