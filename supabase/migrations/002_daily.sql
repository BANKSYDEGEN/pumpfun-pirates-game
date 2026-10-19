-- PUMPFUN PIRATES · migration 002: DAILY challenge scores
-- Safe to run more than once (idempotent). Run in Supabase: SQL Editor -> New query -> paste -> Run.
-- Adds two nullable columns to public.scores:
--   mode  text  null = normal run, 'daily' = daily challenge run
--   seed  text  the UTC day of the daily run, 'YYYY-MM-DD' (null for normal runs)
-- Existing rows stay normal runs (mode is null). Normal score inserts are unchanged.

alter table public.scores add column if not exists mode text;
alter table public.scores add column if not exists seed text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'scores_mode_check' and conrelid = 'public.scores'::regclass) then
    alter table public.scores add constraint scores_mode_check
      check (mode is null or mode = 'daily');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'scores_seed_check' and conrelid = 'public.scores'::regclass) then
    alter table public.scores add constraint scores_seed_check
      check ((mode is null and seed is null)
          or (mode = 'daily' and seed ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'));
  end if;
end $$;

create index if not exists scores_daily_seed_score_idx on public.scores (seed, score desc) where mode = 'daily';

-- Insert policy: same checks as before, plus a daily run may only be posted for today's UTC seed
-- (or yesterday's, so a run that started just before midnight UTC can still be saved).
drop policy if exists "anyone can submit a score" on public.scores;
create policy "anyone can submit a score"
  on public.scores for insert
  to anon, authenticated
  with check (
    score between 0 and 1000000
    and char_length(wallet) between 32 and 44
    and (name is null or char_length(name) <= 20)
    and (
      (mode is null and seed is null)
      or (mode = 'daily' and seed in (
            to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD'),
            to_char((now() at time zone 'utc')::date - 1, 'YYYY-MM-DD')))
    )
  );

-- Normal boards keep showing normal runs only.
create or replace view public.leaderboard_best
with (security_invoker = true) as
select distinct on (wallet)
  wallet, name, score, wave, sunk, created_at
from public.scores
where mode is null
order by wallet, score desc, created_at asc;

-- DAILY board: best score per wallet per seed (the client asks for one seed: ?seed=eq.YYYY-MM-DD).
create or replace view public.leaderboard_daily
with (security_invoker = true) as
select distinct on (seed, wallet)
  seed, wallet, name, score, wave, sunk, created_at
from public.scores
where mode = 'daily'
order by seed, wallet, score desc, created_at asc;

grant select on public.leaderboard_best to anon, authenticated;
grant select on public.leaderboard_daily to anon, authenticated;
grant select, insert on public.scores to anon, authenticated;

-- The per-wallet rate limit trigger (public.scores_rate_limit, 30 inserts / wallet / hour) only reads
-- wallet and created_at, so it keeps working unchanged and counts daily runs too. Nothing to do here.
