-- PUMPFUN PIRATES · migration 024 (v103): Waves payout rescaled to the v103 skin price ladder (BANKSY: skins 5,000-250,000 gold).
-- Only widens the per-run limits on pvp_waves_payouts (a table added by 023 today). No gold, score, leaderboard or player row changes.
begin;
alter table public.pvp_waves_payouts drop constraint if exists pvp_waves_payouts_base_gold_check;
alter table public.pvp_waves_payouts drop constraint if exists pvp_waves_payouts_gold_check;
alter table public.pvp_waves_payouts add constraint pvp_waves_payouts_base_gold_check check (base_gold between 0 and 10000);
alter table public.pvp_waves_payouts add constraint pvp_waves_payouts_gold_check check (gold between 0 and 20000);
commit;
