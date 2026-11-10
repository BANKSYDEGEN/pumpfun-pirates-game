-- PUMPFUN PIRATES · migration 030 (security fix H1, SECURITY_FIXES.md). APPLIED 2026-11-09 inside 20261110020000_security_crit_high.sql.
-- APPLY LAST: after the new `pvp` function (action waves_score) is live AND the new client has been out long enough for
-- players to have reloaded (service worker v112). From then on the anon key can no longer write leaderboard rows: every Waves
-- score goes through the `pvp` function, which checks it against the server-timed run (waves_start) like the gold payout.
-- An old cached client's direct insert then fails with 401/403 and the game says "Saved on this device" (no crash).
-- Reading the boards (select on scores / leaderboard_best / leaderboard_daily) is unchanged. No row is changed or deleted.
begin;
drop policy if exists "anyone can submit a score" on public.scores;
drop policy if exists "anon cannot self-verify" on public.scores;
revoke insert, update, delete, truncate on public.scores from anon, authenticated;
commit;

-- ROLLBACK (re-opens the direct insert exactly as migrations 002 / 003 had it):
-- begin;
--   create policy "anyone can submit a score" on public.scores for insert to anon, authenticated with check (
--     score between 0 and 1000000 and char_length(wallet) between 32 and 44 and (name is null or char_length(name) <= 20)
--     and ((mode is null and seed is null) or (mode = 'daily' and seed in (
--       to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD'), to_char((now() at time zone 'utc')::date - 1, 'YYYY-MM-DD')))));
--   create policy "anon cannot self-verify" on public.scores as restrictive for insert to anon, authenticated with check (verified = false);
--   grant insert on public.scores to anon, authenticated;
-- commit;
