-- Five seconds of crash display, then ten seconds of shared betting countdown.
create or replace function colorwin_private.aviator_current(p_now timestamptz) returns colorwin_private.arcade_flights
language plpgsql set search_path='' as $$
declare f colorwin_private.arcade_flights; start_time timestamptz; mx numeric;begin
 select * into f from colorwin_private.arcade_flights where is_shared order by starts_at desc limit 1;
 if f.id is not null and p_now<f.crash_at+interval '5 seconds' then return f;end if;
 perform pg_advisory_xact_lock(hashtextextended('colorwin-aviator-shared',94));
 select * into f from colorwin_private.arcade_flights where is_shared order by starts_at desc limit 1;
 loop
  exit when f.id is not null and p_now<f.crash_at+interval '5 seconds';
  start_time:=case when f.id is null then p_now+interval '10 seconds' else f.crash_at+interval '15 seconds' end;
  mx:=round(least(50,greatest(1.01,1-ln(1-colorwin_private.arcade_random())*1.6)),2);
  insert into colorwin_private.arcade_flights(user_id,is_shared,starts_at,crash_at,crash_multiplier,growth_rate)
  values(null,true,start_time,start_time+ln(mx::double precision)/.06*interval '1 second',mx,.06) returning * into f;
 end loop;
 return f;
end $$;
revoke all on function colorwin_private.aviator_current(timestamptz) from public,anon,authenticated;
