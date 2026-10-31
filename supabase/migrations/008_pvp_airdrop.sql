-- PUMPFUN PIRATES · migration 008: optional airdrop wallet typed on the PvP entry pop-up. NEW table only.
-- Private: RLS on with NO policies + no grants, so anon/authenticated can't read or write it. Written only by the `pvp`
-- Edge Function (service role), rate-limited there (one change per 30 s per player). Never broadcast, never shown to others.
create table if not exists public.pvp_airdrop (
  player_id text primary key check (player_id ~ '^(wallet:[1-9A-HJ-NP-Za-km-z]{32,44}|dev:[0-9a-f]{24})$'),
  wallet text not null check (wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  name text not null default 'PIRATE' check (char_length(name) between 1 and 20),
  writes integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pvp_airdrop_wallet_idx on public.pvp_airdrop (wallet);
alter table public.pvp_airdrop enable row level security;
revoke all on public.pvp_airdrop from anon, authenticated;
