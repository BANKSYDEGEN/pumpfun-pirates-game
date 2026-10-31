-- PUMPFUN PIRATES · migration 009: "my" PvP stats for the HUD (BANKSY: the # next to your name = your Battle Royale
-- all-time kills rank; kills / deaths persist across sessions). NEW read-only function only; no table changes, no data touched.
-- Same identity and ordering as pvp_kills_top('all'): kills desc, deaths asc, oldest player first. Unranked (0 kills) = rank null.
create or replace function public.pvp_kills_me(p_player text)
returns table (rank bigint, kills bigint, deaths bigint) language sql stable security definer set search_path = public as $$
  with k as (select killer_id as id, count(*) as kills from pvp_kills group by killer_id),
       d as (select victim_id as id, count(*) as deaths from pvp_kills group by victim_id),
       b as (select k.id, k.kills, coalesce(d.deaths, 0) as deaths, p.updated_at from k join pvp_players p on p.id = k.id left join d on d.id = k.id),
       me as (select coalesce((select kills from k where id = p_player), 0) as kills, coalesce((select deaths from d where id = p_player), 0) as deaths,
                     (select updated_at from pvp_players where id = p_player) as up)
  select case when me.kills = 0 then null else 1 + (select count(*) from b where b.id <> p_player and
           (b.kills > me.kills or (b.kills = me.kills and (b.deaths < me.deaths or (b.deaths = me.deaths and b.updated_at < me.up))))) end,
         me.kills, me.deaths
  from me;
$$;
revoke all on function public.pvp_kills_me(text) from public, anon, authenticated;
