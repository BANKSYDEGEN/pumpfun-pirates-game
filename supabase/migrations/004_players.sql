-- PUMPFUN PIRATES · migration 004: wallet sign-in (read-only signMessage) + server-saved progress.
-- Safe to run more than once. Only the `pirate` Edge Function (service role) reads or writes these tables:
-- RLS is ON with NO policies, and anon / authenticated have no grants, so the public anon key gets nothing.

create table if not exists public.players (
  wallet            text primary key check (wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  name              text check (name is null or (char_length(name) <= 20 and name !~ '[<>&"`\\]')),
  progress          jsonb not null default '{}'::jsonb,   -- { skins: { owned: [...], equipped }, best: { score, wave } }
  is_holder         boolean,                               -- reserved for a later NFT holder perk (nothing sets it yet)
  holder_checked_at timestamptz,                           -- reserved
  runs              integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- one-time sign-in nonces (server issued, short expiry, single use)
create table if not exists public.wallet_nonces (
  nonce      text primary key,
  wallet     text not null,
  message    text not null,              -- the exact text the wallet must sign
  expires_at timestamptz not null,
  used       boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.players alter column is_holder drop not null, alter column is_holder drop default;
alter table public.wallet_nonces add column if not exists message text;
create index if not exists wallet_nonces_expires_idx on public.wallet_nonces (expires_at);

-- sessions: only the SHA-256 of the random token is stored
create table if not exists public.player_sessions (
  token_hash text primary key,
  wallet     text not null references public.players(wallet) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists player_sessions_wallet_idx on public.player_sessions (wallet);

alter table public.players enable row level security;
alter table public.wallet_nonces enable row level security;
alter table public.player_sessions enable row level security;
revoke all on public.players, public.wallet_nonces, public.player_sessions from anon, authenticated;
