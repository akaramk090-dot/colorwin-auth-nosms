create or replace function colorwin_private.lottery_odds(g text,s text) returns numeric language plpgsql immutable set search_path='' as $$
declare n integer;counts integer[]:=array[1,3,6,10,15,21,25,27,27,25,21,15,10,6,3,1];begin
 if g='k3' then
  if s in('Big','Small','Odd','Even') then return 1.96;end if;
  if s ~ '^sum:([3-9]|1[0-8])$' then n:=split_part(s,':',2)::integer;return trunc(211.68/counts[n-2],2);end if;
  if s ~ '^triple:[1-6]$' then return 207.36;end if;
  if s='Any triple' then return 34.56;end if;
  if s ~ '^pair:[1-6]$' then return 12.96;end if;
  if s ~ '^pair:[1-6]:[1-6]$' and split_part(s,':',2)<>split_part(s,':',3) then return 69.12;end if;
  if s ~ '^different:[1-6],[1-6],[1-6]$' and substring(s from 11 for 1)<substring(s from 13 for 1) and substring(s from 13 for 1)<substring(s from 15 for 1) then return 34.56;end if;
  if s ~ '^two:[1-6],[1-6]$' and substring(s from 5 for 1)<substring(s from 7 for 1) then return 6.91;end if;
  if s='Sequence' then return 8.64;end if;
 elsif g='5d' then
  if s ~ '^[A-E]:[0-9]$' then return 9.8;end if;
  if s ~ '^[A-E]:(Big|Small|Odd|Even)$' then return 1.96;end if;
  if s in('Sum:Big','Sum:Small','Sum:Odd','Sum:Even') then return 1.96;end if;
 elsif g='trx-wingo' then
  if s ~ '^[0-9]$' then return 9.8;end if;
  if s in('Green','Red','Big','Small') then return 1.96;end if;
  if s='Violet' then return 4.41;end if;
 end if;
 raise exception 'Invalid lottery selection';
end $$;
create or replace function colorwin_private.lottery_payout(g text,s text,a integer[],stake numeric,odds numeric) returns numeric language plpgsql immutable set search_path='' as $$
declare n integer;total integer;hit boolean:=false;kind text;sorted integer[];begin
 select sum(x) into total from unnest(a)x;
 if g='k3' then
  hit:=case when s='Big' then total>=11 when s='Small' then total<=10 when s='Odd' then total%2=1 when s='Even' then total%2=0
   when s like 'sum:%' then total=split_part(s,':',2)::integer
   when s='Any triple' then a[1]=a[2] and a[2]=a[3]
   when s like 'triple:%' then a[1]=split_part(s,':',2)::integer and a[1]=a[2] and a[2]=a[3] else false end;
  if s ~ '^pair:[1-6]$' then hit:=(select count(*) from unnest(a)x where x=split_part(s,':',2)::integer)>=2;
  elsif s ~ '^pair:[1-6]:[1-6]$' then hit:=(select count(*) from unnest(a)x where x=split_part(s,':',2)::integer)=2 and split_part(s,':',3)::integer=any(a);
  elsif s like 'different:%' then select array_agg(x order by x) into sorted from unnest(a)x;hit:=sorted=string_to_array(split_part(s,':',2),',')::integer[];
  elsif s like 'two:%' then hit:=substring(s from 5 for 1)::integer=any(a) and substring(s from 7 for 1)::integer=any(a);
  elsif s='Sequence' then select array_agg(x order by x) into sorted from unnest(a)x;hit:=sorted[2]=sorted[1]+1 and sorted[3]=sorted[2]+1;end if;
 elsif g='5d' then
  n:=case when s like 'Sum:%' then total else a[ascii(left(s,1))-64] end;kind:=split_part(s,':',2);
  hit:=case when kind='Big' then n>=case when s like 'Sum:%' then 23 else 5 end when kind='Small' then n<case when s like 'Sum:%' then 23 else 5 end
   when kind='Odd' then n%2=1 when kind='Even' then n%2=0 else kind=n::text end;
 elsif g='trx-wingo' then
  n:=a[1];hit:=case when s='Big' then n>=5 when s='Small' then n<5 when s='Green' then n%2=1 when s='Red' then n%2=0 when s='Violet' then n in(0,5) else s=n::text end;
  if hit and s in('Green','Red') and n in(0,5) then return trunc(stake*1.47,2);end if;
 end if;
 return case when hit then trunc(stake*odds,2) else 0 end;
end $$;
