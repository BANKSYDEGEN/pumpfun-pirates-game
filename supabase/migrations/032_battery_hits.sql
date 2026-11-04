-- PUMPFUN PIRATES · migration 032 (BANKSY: "On the cliff cannons give them 50 gold any time they hit a ship"). ADDITIVE ONLY:
-- one new counter column on each save table (default 0). No existing row, column, leaderboard or score is changed or deleted.
-- battery_hits = paid cliff-cannon hits; the pvp function allows 50 gold per counted hit, at most 2 + 10 / min, never down.
begin;
alter table public.pvp_profiles add column if not exists battery_hits integer not null default 0 check (battery_hits >= 0);
alter table public.pvp_dev_profiles add column if not exists battery_hits integer not null default 0 check (battery_hits >= 0);
commit;
