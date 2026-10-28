create function colorwin_private.winning_feed() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from(
 select g.game_name as game, 'Member***'||right(p.public_uid::text,3) as member,g.winnings as amount
 from public.account_game_records g join public.profiles p on p.id=g.user_id
 where g.winnings>0 and g.created_at>=now()-interval '7 days'
 order by g.created_at desc,g.id desc limit 20
 ) x where colorwin_private.assert_active() is not null;
$$;
revoke all on function colorwin_private.winning_feed() from public,anon;
grant execute on function colorwin_private.winning_feed() to authenticated;
create function public.colorwin_winning_feed() returns jsonb language sql security invoker set search_path='' as $$select colorwin_private.winning_feed();$$;
revoke all on function public.colorwin_winning_feed() from public,anon;
grant execute on function public.colorwin_winning_feed() to authenticated;
