begin;
alter table public.cw_tournaments add column registration_closed boolean not null default false;
do $$declare definition text;begin
 definition:=pg_get_functiondef('colorwin_private.tournament_action(text,jsonb)'::regprocedure);
 if position('or t.starts_at<=now()' in definition)=0 then raise exception 'Expected tournament time gate missing';end if;
 definition:=replace(definition,'or t.starts_at<=now()','or t.registration_closed');
 definition:=replace(definition,'to_jsonb(x) order by starts_at','to_jsonb(x) order by starts_at');
 definition:=replace(definition,'from public.cw_tournaments x where status<>''draft''','from (select tm.*,(select count(*) from public.cw_tournament_entries en where en.tournament_id=tm.id and en.status<>''cancelled'') as joined_count from public.cw_tournaments tm where tm.status<>''draft'') x');
 execute definition;
 definition:=pg_get_functiondef('colorwin_private.admin_action_internal(text,jsonb,text)'::regprocedure);
 definition:=replace(definition,'if coalesce(p_data->>''room_id'','''')<>'''' then',
 'if p_data ? ''registration_closed'' then
   if jsonb_typeof(p_data->''registration_closed'') is distinct from ''boolean'' then raise exception ''Invalid registration setting'';end if;
   update public.cw_tournaments set registration_closed=(p_data->>''registration_closed'')::boolean where id=t.id returning * into t;
  end if;
  if coalesce(p_data->>''room_id'','''')<>'''' then');
 execute definition;
end $$;
commit;
