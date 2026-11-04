-- PUMPFUN PIRATES · migration 033 (BANKSY: "can we give Banksy a terrain edit device and I'll level it where needed").
-- ADDITIVE ONLY: one new table. No existing row, column, leaderboard, score or player save is changed or deleted.
-- pvp_terrain: the island's height-delta layer (one row, id 'island'). cells = { grid cell index: centimetres }. Written ONLY by the
-- pvp function for the owner (service role; RLS on, no policies = no client access). log = the BACKUP: the previous 20 states (cells + pieces).
begin;
create table if not exists public.pvp_terrain (
  id         text primary key,
  cells      jsonb not null default '{}'::jsonb,
  pieces     jsonb not null default '{}'::jsonb,   -- built-in world pieces: { stable id: { h: 1 } (hidden) | { dx, dy, dz, ry } (moved) }
  rev        integer not null default 0,
  log        jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.pvp_terrain enable row level security;
commit;
