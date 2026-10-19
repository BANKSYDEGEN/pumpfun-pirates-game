-- PUMPFUN PIRATES · migration 003: verified scores (wallet ownership proven with a Phantom signMessage)
-- Safe to run more than once. Only needed when you turn on WALLET_VERIFY_ENABLED.
-- Rows are only ever marked verified by the verify-score Edge Function (service role, bypasses RLS)
-- after it checks the ed25519 signature. Browsers (anon key) can never insert verified = true.

alter table public.scores add column if not exists verified boolean not null default false;

-- Extra RESTRICTIVE insert policy, ANDed with the existing "anyone can submit a score" policy
-- (works whether or not migration 002 has been run).
drop policy if exists "anon cannot self-verify" on public.scores;
create policy "anon cannot self-verify"
  on public.scores as restrictive for insert
  to anon, authenticated
  with check (verified = false);

create index if not exists scores_verified_score_idx on public.scores (score desc) where verified;

-- The rate limit trigger (public.scores_rate_limit) still applies to Edge Function inserts:
-- triggers run for the service role too.
