-- [v342] BANKSY t1810u / t1811u "Casino gold is broken · if lose all money goes to zero if win get 9999999 gold"
-- 048 answered the OWNER with a hard-coded 999999 on every debit / win and read his loss balance from pvp_dev_profiles (he has no
-- row there: his gold is the shared pot in pvp_group_saves) -> the client set 0 on a loss, 999999 on a win.
-- Now: the owner's bets move his real pot (pvp_group_saves, main = pvp_inv_owner()); every other pirate's row as before, plus the
-- shop rev on every reply (so the next dev_sync / wallet save neither re-subtracts the bet nor 409s) and a 10,000,000 cap on wins.
-- Security unchanged: definer functions, service role only, casino flag, bet 10..25000, rate limit, (req) idempotency.
begin;

create or replace function public.pvp_casino_debit(p_player text, p_bet integer, p_req text, p_game text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); g integer; rv integer; prev pvp_purchases; is_wallet boolean := pid like 'wallet:%';
  is_owner boolean := pid = public.pvp_inv_owner();
  bet integer := least(greatest(coalesce(p_bet, 0), 0), 25000);
begin
  if not pvp_flag('casino') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  if bet < 10 then return jsonb_build_object('ok', false, 'why', 'min bet'); end if;
  if p_req is null or p_game is null or p_game not in ('blackjack','roulette','dice','slots') then
    return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
  select * into prev from pvp_purchases where req = p_req;
  if found then
    if prev.player_id <> pid then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
    return jsonb_build_object('ok', true, 'gold', prev.gold_after, 'debited', prev.price, 'rev', prev.rev, 'owner', is_owner, 'retry', true);
  end if;
  if not pvp_rl_hit('casino:' || pid, 60, 40) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
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
  return jsonb_build_object('ok', true, 'owner', false, 'gold', g - bet, 'debited', bet, 'rev', rv);
end $$;
revoke all on function public.pvp_casino_debit(text, integer, text, text) from public, anon, authenticated;

create or replace function public.pvp_casino_credit(p_player text, p_payout integer, p_game text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); g integer; rv integer; is_wallet boolean := pid like 'wallet:%';
  is_owner boolean := pid = public.pvp_inv_owner();
  pay integer := least(greatest(coalesce(p_payout, 0), 0), 10000000);
begin
  if not pvp_flag('casino') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  if is_owner then
    insert into pvp_group_saves (main) values (pid) on conflict (main) do nothing;
    if pay <= 0 then
      select gold into g from pvp_group_saves where main = pid;
      return jsonb_build_object('ok', true, 'owner', true, 'gold', coalesce(g, 0), 'credited', 0, 'rev', 0);
    end if;
    update pvp_group_saves set gold = least(10000000, gold + pay) where main = pid returning gold into g;
    return jsonb_build_object('ok', true, 'owner', true, 'gold', coalesce(g, 0), 'credited', pay, 'rev', 0, 'game', p_game, 'note', p_note);
  end if;
  if pay <= 0 then
    if is_wallet then select gold, shop_rev into g, rv from pvp_profiles where id = pid;
    else select gold, shop_rev into g, rv from pvp_dev_profiles where id = pid; end if;
    return jsonb_build_object('ok', true, 'owner', false, 'gold', coalesce(g, 0), 'credited', 0, 'rev', coalesce(rv, 0));
  end if;
  if is_wallet then update pvp_profiles set gold = least(10000000, gold + pay) where id = pid returning gold, shop_rev into g, rv;
  else update pvp_dev_profiles set gold = least(10000000, gold + pay) where id = pid returning gold, shop_rev into g, rv; end if;
  if not found then return jsonb_build_object('ok', false, 'why', 'no save yet'); end if;
  return jsonb_build_object('ok', true, 'owner', false, 'gold', g, 'credited', pay, 'rev', coalesce(rv, 0), 'game', p_game, 'note', p_note);
end $$;
revoke all on function public.pvp_casino_credit(text, integer, text, text) from public, anon, authenticated;

commit;
