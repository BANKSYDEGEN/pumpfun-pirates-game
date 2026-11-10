-- PUMPFUN PIRATES · security fix C1 / H1 / H2 / H3 / H4 (audit 2026-11-09). Applied to prod 2026-11-09 with the pvp function that uses it.
-- C1 + H3  pvp_casino_results: one stored result per casino round (key = the request id, or 'bjs:' + the blackjack hand id).
--          pvp_casino_settle writes it and pays in ONE transaction; a second settle of the same key pays nothing and returns the
--          stored reply. pvp_casino_debit: the rate limit now counts retries too, and a retry returns the original game + result.
-- H1       pvp_loot_bags.zone: the harbor (presence room) the victim was in when the bag dropped.
-- H2       pvp_inv_find: idol shards only at jungle_shard_0..6, river pearls only at lagoon_p_grotto / lagoon_p1..5.
-- H4       = migration 030: the anon / authenticated roles can no longer insert / change scores (the pvp function's waves_score
--          writes them with the service role after checking the server-timed run). No score row is changed or deleted.
begin;

-- ---------- C1 / H3 ----------
create table if not exists public.pvp_casino_results (
  req text primary key check (char_length(req) between 8 and 80),
  player_id text not null,
  game text not null,
  bet integer not null default 0,
  payout integer not null default 0,
  body jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists pvp_casino_results_player_idx on public.pvp_casino_results (player_id, created_at desc);
alter table public.pvp_casino_results enable row level security;
revoke all on public.pvp_casino_results from public, anon, authenticated;
grant select, insert, update, delete on public.pvp_casino_results to service_role;

CREATE OR REPLACE FUNCTION public.pvp_casino_debit(p_player text, p_bet integer, p_req text, p_game text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pid text := public.pvp_main(p_player); g integer; rv integer; prev pvp_purchases; is_wallet boolean := pid like 'wallet:%';
  is_owner boolean := pid = public.pvp_inv_owner();
  bet integer := least(greatest(coalesce(p_bet, 0), 0), 25000);
begin
  if not pvp_flag('casino') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  if bet < 10 then return jsonb_build_object('ok', false, 'why', 'min bet'); end if;
  if p_req is null or p_game is null or p_game not in ('blackjack','roulette','dice','slots') then
    return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
  -- [security C1] the rate limit counts every call, retries included
  if not pvp_rl_hit('casino:' || pid, 60, 40) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  select * into prev from pvp_purchases where req = p_req;
  if found then
    if prev.player_id <> pid or prev.item not like 'casino:%' then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
    -- [security C1] a retry: the ORIGINAL stake (prev.price) and game, plus the stored result if that round was already settled
    return jsonb_build_object('ok', true, 'gold', prev.gold_after, 'debited', prev.price, 'rev', prev.rev, 'owner', is_owner, 'retry', true,
      'game', substr(prev.item, 8),
      'result', (select r.body from pvp_casino_results r where r.req = p_req and r.player_id = pid));
  end if;
  if is_owner then -- the owner's gold = his shared pot (group_sync), never a hard-coded number
    insert into pvp_group_saves (main) values (pid) on conflict (main) do nothing;
    select gold into g from pvp_group_saves where main = pid for update;
    g := coalesce(g, 0);
    if g < bet then return jsonb_build_object('ok', false, 'why', 'not enough gold', 'gold', g, 'owner', true); end if;
    update pvp_group_saves set gold = g - bet where main = pid;
    insert into pvp_purchases (player_id, req, item, price, gold_before, gold_after, rev)
      values (pid, p_req, 'casino:' || p_game, bet, g, g - bet, 0);
    return jsonb_build_object('ok', true, 'owner', true, 'gold', g - bet, 'debited', bet, 'rev', 0);
  end if;
  if is_wallet then select gold, shop_rev into g, rv from pvp_profiles where id = pid for update;
  else select gold, shop_rev into g, rv from pvp_dev_profiles where id = pid for update; end if;
  if not found then return jsonb_build_object('ok', false, 'why', 'no save yet'); end if;
  if g < bet then return jsonb_build_object('ok', false, 'why', 'not enough gold', 'gold', g, 'owner', false); end if;
  rv := coalesce(rv, 0) + 1;
  if is_wallet then update pvp_profiles set gold = g - bet, shop_rev = rv where id = pid;
  else update pvp_dev_profiles set gold = g - bet, shop_rev = rv where id = pid; end if;
  insert into pvp_purchases (player_id, req, item, price, gold_before, gold_after, rev)
    values (pid, p_req, 'casino:' || p_game, bet, g, g - bet, rv);
  -- [057] BANKSY owns the casino: every stake goes into the owner's pot (the house); winnings are paid back out of it in pvp_casino_credit
  insert into pvp_group_saves (main) values (public.pvp_inv_owner()) on conflict (main) do nothing;
  update pvp_group_saves set gold = least(10000000, coalesce(gold, 0) + bet) where main = public.pvp_inv_owner();
  return jsonb_build_object('ok', true, 'owner', false, 'gold', g - bet, 'debited', bet, 'rev', rv);
end $function$;

-- settle a round ONCE: the first call stores the reply and pays; any later call with the same key pays nothing
CREATE OR REPLACE FUNCTION public.pvp_casino_settle(p_player text, p_key text, p_game text, p_bet integer, p_payout integer, p_note text, p_body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pid text := public.pvp_main(p_player); n integer; prev jsonb; cr jsonb;
begin
  if not pvp_flag('casino') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  if p_key is null or char_length(p_key) not between 8 and 80 then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
  insert into pvp_casino_results (req, player_id, game, bet, payout, body)
    values (p_key, pid, coalesce(p_game, ''), coalesce(p_bet, 0), greatest(coalesce(p_payout, 0), 0), coalesce(p_body, '{}'::jsonb))
    on conflict (req) do nothing;
  get diagnostics n = row_count;
  if n = 0 then
    select body into prev from pvp_casino_results where req = p_key and player_id = pid;
    return jsonb_build_object('ok', false, 'why', 'settled', 'stored', prev);
  end if;
  cr := public.pvp_casino_credit(p_player, greatest(coalesce(p_payout, 0), 0), p_game, p_note);
  if not coalesce((cr->>'ok')::boolean, false) then raise exception 'pvp_casino_settle: credit refused (%)', cr->>'why'; end if;
  return cr || jsonb_build_object('settled', true);
end $function$;
revoke all on function public.pvp_casino_settle(text, text, text, integer, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.pvp_casino_settle(text, text, text, integer, integer, text, jsonb) to service_role;
revoke all on function public.pvp_casino_debit(text, integer, text, text) from public, anon, authenticated;
grant execute on function public.pvp_casino_debit(text, integer, text, text) to service_role;

-- ---------- H1 ----------
alter table public.pvp_loot_bags add column if not exists zone text;

-- ---------- H2 ----------
CREATE OR REPLACE FUNCTION public.pvp_inv_find(p_player text, p_item text, p_spot text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pid text := public.pvp_main(p_player); n integer;
begin
  if p_spot !~ '^[a-z0-9_]{2,32}$' then return jsonb_build_object('ok', false, 'why', 'bad find'); end if;
  -- [security H2] the 7 real idol-shard spots, the 6 real river-pearl spots, the 4 ruin chests
  if not ((p_item = 'val:idol_shard' and p_spot ~ '^jungle_shard_[0-6]$')
       or (p_item = 'val:river_pearl' and p_spot ~ '^lagoon_p(_grotto|[1-5])$')
       or (p_spot in ('jungle_ruin_chest', 'j_moss', 'j_idol', 'j_ledge') and p_item in ('val:silver_ring', 'val:gold_bar', 'val:pearl_necklace', 'val:ruby'))) then
    return jsonb_build_object('ok', false, 'why', 'bad find'); end if;
  insert into pvp_inv_once (player_id, k) values (pid, 'find:' || p_spot || ':' || current_date) on conflict do nothing; get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'why', 'found today'); end if;
  perform pvp_inv_add(pid, p_item, 1, case when p_spot like 'j%' and p_item <> 'val:idol_shard' then 'chest' else 'find' end, 'find', p_spot); return jsonb_build_object('ok', true, 'item', p_item);
end $function$;

-- ---------- H4 (= 030_scores_server_only.sql) ----------
drop policy if exists "anyone can submit a score" on public.scores;
drop policy if exists "anon cannot self-verify" on public.scores;
revoke insert, update, delete, truncate on public.scores from anon, authenticated;

commit;

-- ROLLBACK (functions: /workspace/backups/security-fix-20261109-205226/sql/functions_before.sql restores pvp_casino_debit and
-- pvp_inv_find exactly as they were; redeploy the v89 pvp source first, since it never calls pvp_casino_settle):
-- begin;
--   drop function if exists public.pvp_casino_settle(text, text, text, integer, integer, text, jsonb);
--   drop table if exists public.pvp_casino_results;
--   alter table public.pvp_loot_bags drop column if exists zone;
--   (scores: the ROLLBACK block of 030_scores_server_only.sql)
-- commit;
