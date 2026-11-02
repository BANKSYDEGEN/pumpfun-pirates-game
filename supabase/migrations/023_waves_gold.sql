-- PUMPFUN PIRATES · migration 023 (v103): WAVES PAYS GOLD FROM SCORE (BANKSY: "earn gold from waves based on score, not on what
-- gold they die with"). Before this, Waves gold never left the run. Now the end of a Waves run banks gold into the Battle Royale
-- save (the shop's gold) from the run's SCORE, checked server-side. ADDITIVE ONLY: two new tables + one function. No existing
-- gold, score, leaderboard or player row is changed by this migration.
begin;
-- a run the server saw START (server clock = the run's real length; the client's duration is never trusted)
create table if not exists public.pvp_waves_runs (
  run_id     text primary key check (run_id ~ '^[a-z0-9]{12,40}$'),
  player_id  text not null,
  started_at timestamptz not null default now()
);
create index if not exists pvp_waves_runs_player_idx on public.pvp_waves_runs (player_id, started_at desc);
-- one payout per run (primary key), append-only
create table if not exists public.pvp_waves_payouts (
  run_id     text primary key references public.pvp_waves_runs (run_id),
  player_id  text not null,
  score      integer not null check (score between 0 and 1000000),
  wave       integer not null check (wave between 0 and 500),
  sunk       integer not null check (sunk between 0 and 5000),
  elapsed_s  integer not null,
  base_gold  integer not null check (base_gold between 0 and 800),
  gold       integer not null check (gold between 0 and 1600),
  holder     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists pvp_waves_payouts_player_idx on public.pvp_waves_payouts (player_id, created_at desc);
alter table public.pvp_waves_runs enable row level security;
alter table public.pvp_waves_payouts enable row level security;
revoke all on public.pvp_waves_runs, public.pvp_waves_payouts from public, anon, authenticated;

-- the claim, in one transaction: one payout per run, the run must be this player's, a daily cap, then the gold is credited to
-- the server copy (device: pvp_dev_profiles, wallet: pvp_profiles; the owner group's shared pot is credited by its own sync).
create or replace function public.pvp_waves_claim(p_player text, p_run text, p_score integer, p_wave integer, p_sunk integer, p_elapsed integer,
  p_base integer, p_gold integer, p_holder boolean, p_day_cap integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); r pvp_waves_runs; today integer; g integer := p_gold;
begin
  select * into r from pvp_waves_runs where run_id = p_run for update;
  if not found or r.player_id <> pid then return jsonb_build_object('ok', false, 'why', 'unknown run'); end if;
  if exists (select 1 from pvp_waves_payouts where run_id = p_run) then return jsonb_build_object('ok', false, 'why', 'already paid'); end if;
  select coalesce(sum(base_gold), 0) into today from pvp_waves_payouts where player_id = pid and created_at > now() - interval '24 hours';
  if today >= p_day_cap then return jsonb_build_object('ok', false, 'why', 'daily waves gold cap reached'); end if;
  if today + p_base > p_day_cap then g := round(g::numeric * (p_day_cap - today) / greatest(1, p_base)); p_base := p_day_cap - today; end if;
  insert into pvp_waves_payouts (run_id, player_id, score, wave, sunk, elapsed_s, base_gold, gold, holder) values (p_run, pid, p_score, p_wave, p_sunk, p_elapsed, p_base, g, p_holder);
  if pid like 'wallet:%' then update pvp_profiles set gold = least(10000000, gold + g) where id = pid;
  elsif pid <> 'dev:e191a32e15abea4f14355121' then update pvp_dev_profiles set gold = least(10000000, gold + g) where id = pid; end if;
  return jsonb_build_object('ok', true, 'gold', g, 'base', p_base, 'today', today + p_base);
end $$;
revoke all on function public.pvp_waves_claim(text, text, integer, integer, integer, integer, integer, integer, boolean, integer) from public, anon, authenticated;
commit;
