-- PUMPFUN PIRATES · migration 025 (v105, shop goals, Timothy): applied with v105 after a pvp_kills backup. Read-only function only.
-- Numbered after the highest existing: 024_waves_gold_scale.sql + 023_waves_gold.sql + 022_island_shop.sql (emerly/run-shop
-- fb86696) and 021_harbor_copies.sql (pfp-sunk / live). To apply: BANKSY OKs it, back up first, then copy to supabase/migrations/025_shop_goals.sql.
--
-- ADDITIVE ONLY: one new READ-ONLY function. No new tables or columns, nothing updated, reset or deleted (gold, kills, boards
-- untouched). Server-only like pvp_kills_me (016/017): no anon / authenticated grant; only the `pvp` Edge Function calls it.
--
-- What it adds: the shop's DIAMOND card shows its 5,000 BR kills split by mode ("Solo 3,120 · Squads 1,004"). pvp_kills already
-- stores the arena room of every both-sides-confirmed kill: Solo rooms are '<prefix>-<n>' and Squads rooms '<prefix>sq-<n>'
-- (js/pvp.js ROOM_PREFIX / SQ_PREFIX; live 'pfp-pvp-v1-0' / 'pfp-pvp-v1sq-0'), so no new tracking column is needed.
-- Same population as pvp_kills_me (all rooms, alias resolved through pvp_main), so solo + squads = the board's kills.
-- The Edge Function treats a missing function as "no split yet" (the card just shows the total), so the release does not need it.
begin;

create or replace function public.pvp_kills_by_mode(p_player text)
returns table (solo_kills bigint, squads_kills bigint, solo_deaths bigint, squads_deaths bigint)
language sql stable security definer set search_path = public as $$
  with pid as (select pvp_main(p_player) as v)
  select
    count(*) filter (where killer_id = (select v from pid) and room !~ '^pfp-pvp-[A-Za-z0-9]*sq-[0-9]+$'),
    count(*) filter (where killer_id = (select v from pid) and room ~ '^pfp-pvp-[A-Za-z0-9]*sq-[0-9]+$'),
    count(*) filter (where victim_id = (select v from pid) and room !~ '^pfp-pvp-[A-Za-z0-9]*sq-[0-9]+$'),
    count(*) filter (where victim_id = (select v from pid) and room ~ '^pfp-pvp-[A-Za-z0-9]*sq-[0-9]+$')
  from pvp_kills
  where killer_id = (select v from pid) or victim_id = (select v from pid);  -- pvp_kills_killer_idx / pvp_kills_victim_idx (006)
$$;
revoke all on function public.pvp_kills_by_mode(text) from public, anon, authenticated;

commit;
-- ROLLBACK (only if ever needed; touches no data): drop function if exists public.pvp_kills_by_mode(text);
