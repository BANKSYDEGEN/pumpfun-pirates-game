-- [scale-rl] BANKSY t2506u "Keep scaling everything else" (capacity review Fix 6, rate limiter).
-- pvp_rl is a fixed-window counter written on almost every RPC / edge call (83k calls, ~5.3 ms
-- mean, ~35 MB WAL in the current stats window). Rate-limit rows are safe to lose on a crash
-- (limits reset, briefly more permissive). Making the table UNLOGGED drops that WAL and the
-- associated disk flush, which is the cheaper limiter on the Free / Nano plan.
-- GC moves off the 0.2 %-of-hits hot path onto a try-lock, and counters stop incrementing
-- once they are already over the cap (same allow/deny). Limits and keys are unchanged.
-- Idempotent. Raise is `alter table public.pvp_rl set logged;` plus the previous function body.

alter table public.pvp_rl set unlogged;

create or replace function public.pvp_rl_hit(p_key text, p_window_s integer, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ws integer := greatest(1, least(coalesce(p_window_s, 1), 604800));
  mx integer := greatest(0, least(coalesce(p_max, 0), 1000000));
  win timestamptz := to_timestamp(floor(extract(epoch from now()) / ws) * ws);
  c integer;
begin
  if p_key is null or length(btrim(p_key)) < 1 or length(p_key) > 200 then return false; end if;
  insert into pvp_rl (k, w, n) values (left(btrim(p_key), 200), win, 1)
    on conflict (k, w) do update set n = pvp_rl.n + 1
    where pvp_rl.n <= mx
    returning n into c;
  if c is null then return false; end if;
  if pg_try_advisory_xact_lock(hashtext('pvp_rl_gc')) then
    delete from pvp_rl where w < now() - interval '2 hours';
  end if;
  return c <= mx;
end;
$$;

revoke all on function public.pvp_rl_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.pvp_rl_hit(text, integer, integer) to service_role;
