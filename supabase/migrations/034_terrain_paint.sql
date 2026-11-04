-- PUMPFUN PIRATES · migration 034 (BANKSY build mode: PAINT). ADDITIVE ONLY: one new column on pvp_terrain (033), default '{}'.
-- No existing row, column, leaderboard, score or player save is changed or deleted. paint = { grid cell: layer * 1000 + percent }.
begin;
alter table public.pvp_terrain add column if not exists paint jsonb not null default '{}'::jsonb;
commit;
