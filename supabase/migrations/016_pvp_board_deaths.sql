-- v77: a pirate who has died in BATTLE ROYALE is on the board even with 0 kills (kills 0, their deaths, K/D 0.00),
-- ranked below everyone with kills. Board rows = anyone with a confirmed kill OR a confirmed death (pvp_kills, keyed by
-- device id / signed wallet id only; typed wallets never key a row). Read-only functions; no data changed or deleted.
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
  ), ids as (select id from k union select id from d)
  select case when ids.id like 'wallet:%' then 'w:' || substr(ids.id, 8, 4) || '…' || right(ids.id, 4) else 'd:' || substr(ids.id, 5, 6) end,
         coalesce(p.name, 'PIRATE'), coalesce(k.kills, 0), coalesce(d.deaths, 0),
         pvp_short_wallet(coalesce((select a.wallet from pvp_airdrop a where a.player_id = ids.id), case when ids.id like 'wallet:%' then substr(ids.id, 8) end))
  from ids left join pvp_players p on p.id = ids.id left join k on k.id = ids.id left join d on d.id = ids.id
  order by coalesce(k.kills, 0) desc, coalesce(d.deaths, 0) asc, p.updated_at asc nulls last
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;
grant execute on function public.pvp_kills_top(text, integer) to anon, authenticated;

-- player card '#': same population and order as the board (0-kill pirates with a death are ranked, never '#—').
create or replace function public.pvp_kills_me(p_player text)
returns table (rank bigint, kills bigint, deaths bigint) language sql stable security definer set search_path = public as $$
  with k as (select killer_id as id, count(*) as kills from pvp_kills group by killer_id),
       d as (select victim_id as id, count(*) as deaths from pvp_kills group by victim_id),
       ids as (select id from k union select id from d),
       b as (select ids.id, coalesce(k.kills, 0) as kills, coalesce(d.deaths, 0) as deaths, p.updated_at
             from ids left join pvp_players p on p.id = ids.id left join k on k.id = ids.id left join d on d.id = ids.id),
       me as (select coalesce((select kills from k where id = p_player), 0) as kills, coalesce((select deaths from d where id = p_player), 0) as deaths,
                     (select updated_at from pvp_players where id = p_player) as up)
  select case when me.kills = 0 and me.deaths = 0 then null else 1 + (select count(*) from b where b.id <> p_player and
           (b.kills > me.kills or (b.kills = me.kills and (b.deaths < me.deaths or (b.deaths = me.deaths and b.updated_at < me.up))))) end,
         me.kills, me.deaths
  from me;
$$;
revoke all on function public.pvp_kills_me(text) from public, anon, authenticated;
