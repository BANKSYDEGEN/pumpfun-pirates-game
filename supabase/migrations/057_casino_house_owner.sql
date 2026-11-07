-- 057 BANKSY owns the Golden Doubloon Casino (t2008u: "Make banksy own the casino all gold lost goes to banksy").
-- A non-owner's stake moves into the owner's pot (pvp_group_saves, main = pvp_inv_owner()); a payout comes back out of that pot
-- (floored at 0). Net: the owner keeps every coin the players lose. The owner playing his own tables is unchanged (his pot only).
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
  -- [057] BANKSY owns the casino: every stake goes into the owner's pot (the house); winnings are paid back out of it in pvp_casino_credit
  insert into pvp_group_saves (main) values (public.pvp_inv_owner()) on conflict (main) do nothing;
  update pvp_group_saves set gold = least(10000000, coalesce(gold, 0) + bet) where main = public.pvp_inv_owner();
  return jsonb_build_object('ok', true, 'owner', false, 'gold', g - bet, 'debited', bet, 'rev', rv);
end $function$;

CREATE OR REPLACE FUNCTION public.pvp_casino_credit(p_player text, p_payout integer, p_game text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- [057] the house (BANKSY's pot) pays the winnings it holds; if a hot streak empties it, the rest is paid anyway (never below 0)
  update pvp_group_saves set gold = greatest(0, coalesce(gold, 0) - pay) where main = public.pvp_inv_owner();
  return jsonb_build_object('ok', true, 'owner', false, 'gold', g, 'credited', pay, 'rev', coalesce(rv, 0), 'game', p_game, 'note', p_note);
end $function$;

revoke execute on function public.pvp_casino_debit(text, integer, text, text) from public, anon, authenticated;
revoke execute on function public.pvp_casino_credit(text, integer, text, text) from public, anon, authenticated;
