-- PUMPFUN PIRATES · migration 005: PvP arena saves (wallet-signed). NEW tables only; nothing existing is touched.
-- Only the `pvp` Edge Function (service role) reads or writes them: RLS ON, no policies, no anon/authenticated grants.
-- id is a profile key: 'wallet:<pubkey>' today; later 'mint:<ship NFT mint>' for per-ship upgrades (mint column reserved).
create table if not exists public.pvp_profiles (
  id          text primary key check (id ~ '^(wallet|mint):[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  wallet      text not null check (wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  mint        text check (mint is null or mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  gold        integer not null default 0 check (gold >= 0),
  upgrades    jsonb not null default '{}'::jsonb,                          -- { hull: 0..6, armor, sails, rudder, cannons: 0..8, reload, range }
  skins       jsonb not null default '{"owned":[],"equipped":"classic"}'::jsonb,
  kills       integer not null default 0 check (kills >= 0),               -- real players only
  deaths      integer not null default 0 check (deaths >= 0),
  bot_kills   integer not null default 0 check (bot_kills >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists pvp_profiles_wallet_idx on public.pvp_profiles (wallet);

create table if not exists public.pvp_nonces (
  nonce text primary key, wallet text not null, message text not null,
  expires_at timestamptz not null, used boolean not null default false, created_at timestamptz not null default now()
);
create index if not exists pvp_nonces_expires_idx on public.pvp_nonces (expires_at);

create table if not exists public.pvp_sessions (       -- only the SHA-256 of the random session token is stored
  token_hash text primary key, wallet text not null, expires_at timestamptz not null, created_at timestamptz not null default now()
);
create index if not exists pvp_sessions_wallet_idx on public.pvp_sessions (wallet);

alter table public.pvp_profiles enable row level security;
alter table public.pvp_nonces enable row level security;
alter table public.pvp_sessions enable row level security;
revoke all on public.pvp_profiles, public.pvp_nonces, public.pvp_sessions from anon, authenticated;
