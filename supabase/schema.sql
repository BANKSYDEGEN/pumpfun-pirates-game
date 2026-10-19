-- PUMPFUN PIRATES · Storm Hunt leaderboard (Supabase / Postgres)
-- Run in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  wallet      text not null check (wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  name        text check (name is null or (char_length(name) <= 20 and name !~ '[<>&"`\\]')),
  score       integer not null check (score between 0 and 1000000),
  wave        integer not null default 1 check (wave between 1 and 500),
  sunk        integer not null default 0 check (sunk between 0 and 5000),
  duration_s  integer check (duration_s is null or duration_s between 0 and 86400),
  created_at  timestamptz not null default now(),
  -- crude plausibility: you can't sink ships faster than ~1 every 5 s
  constraint plausible_sinks check (duration_s is null or sunk <= greatest(1, duration_s / 5))
);

create index if not exists scores_wallet_score_idx on public.scores (wallet, score desc);
create index if not exists scores_score_idx on public.scores (score desc);

-- Row Level Security: anyone (anon key) may INSERT and READ, nobody may UPDATE or DELETE.
alter table public.scores enable row level security;

drop policy if exists "anyone can read scores" on public.scores;
create policy "anyone can read scores"
  on public.scores for select
  to anon, authenticated
  using (true);

drop policy if exists "anyone can submit a score" on public.scores;
create policy "anyone can submit a score"
  on public.scores for insert
  to anon, authenticated
  with check (
    score between 0 and 1000000
    and char_length(wallet) between 32 and 44
    and (name is null or char_length(name) <= 20)
  );
-- (no update / delete policies => those are denied for anon)

-- Best score per wallet, used by the game's top-10 board.
create or replace view public.leaderboard_best
with (security_invoker = true) as
select distinct on (wallet)
  wallet, name, score, wave, sunk, created_at
from public.scores
order by wallet, score desc, created_at asc;

grant select on public.leaderboard_best to anon, authenticated;
grant select, insert on public.scores to anon, authenticated;

-- Optional: simple per-wallet rate limit (max 30 submissions per hour).
create or replace function public.scores_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.scores
      where wallet = new.wallet and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate limit: too many scores for this wallet';
  end if;
  return new;
end $$;

drop trigger if exists scores_rate_limit on public.scores;
create trigger scores_rate_limit before insert on public.scores
  for each row execute function public.scores_rate_limit();
