-- v75 correction (BANKSY, 3:18 PM): devices stay separate unless a wallet is SIGNED in. Undo the manual alias from 013:
-- re-point the 3 kills that device 'BANKSY' (dev:c53d…) made (ids 71, 72, 73 vs dev:a598…, 18:55–19:02 UTC) back to it.
-- No kills / claims were recorded through the alias after it was created (checked). Only the wrongly-created alias row is removed.
update public.pvp_kills set killer_id = 'dev:c53da939472a7ae23f6dd873'
  where id in (71, 72, 73) and killer_id = 'dev:e191a32e15abea4f14355121' and victim_id = 'dev:a598ff2ad74b60d741a1a074';
delete from public.pvp_alias where dev = 'dev:c53da939472a7ae23f6dd873' and main = 'dev:e191a32e15abea4f14355121';
-- the board's wallet column is display-only: the short TYPED wallet of that exact device row (no alias lookups).
create or replace function public.pvp_kills_top(p_period text, p_limit integer)
returns table(player text, name text, kills bigint, deaths bigint, wallet text)
language sql stable security definer set search_path = public as $$
  with since as (
    select case p_period
      when 'day' then date_trunc('day', now() at time zone 'America/Indiana/Indianapolis') at time zone 'America/Indiana/Indianapolis'
      when 'month' then date_trunc('month', now() at time zone 'America/Indiana/Indianapolis') at time zone 'America/Indiana/Indianapolis'
      else '-infinity'::timestamptz end as t
  ), k as (
    select killer_id as id, count(*) as kills from pvp_kills, since where created_at >= since.t group by killer_id
  ), d as (
    select victim_id as id, count(*) as deaths from pvp_kills, since where created_at >= since.t group by victim_id
  )
  select case when k.id like 'wallet:%' then 'w:' || substr(k.id, 8, 4) || '…' || right(k.id, 4) else 'd:' || substr(k.id, 5, 6) end,
         p.name, k.kills, coalesce(d.deaths, 0),
         pvp_short_wallet(coalesce((select a.wallet from pvp_airdrop a where a.player_id = k.id), case when k.id like 'wallet:%' then substr(k.id, 8) end))
  from k join pvp_players p on p.id = k.id left join d on d.id = k.id
  order by k.kills desc, coalesce(d.deaths, 0) asc, p.updated_at asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;
