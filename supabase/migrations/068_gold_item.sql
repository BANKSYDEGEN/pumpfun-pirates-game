-- PUMPFUN PIRATES · migration 068: GOLD AS AN ITEM (house store + give).
-- Spendable gold STAYS in pvp_profiles / pvp_dev_profiles (and the owner pot).
-- House chests may hold stacked `val:gold` that is NOT spendable until withdrawn.
-- Giving gold moves balance → balance atomically (never via pvp_inv).
-- ADDITIVE. Client kill switch: &golditem=0. Edge: houses.ts / inventory.ts gold branches.
begin;

insert into public.pvp_flags (k, on_, note) values
  ('gold_item', true, 'gold as house/gift item (068): store/withdraw/give via balance, chest holds val:gold')
  on conflict (k) do nothing;

-- Chest stacks need room for large gold piles (profiles gold cap is 10_000_000).
alter table public.pvp_house_storage drop constraint if exists pvp_house_storage_qty_check;
alter table public.pvp_house_storage add constraint pvp_house_storage_qty_check check (qty between 1 and 10000000);

-- ---------- deposit spendable gold into own cottage / ship chest ----------
create or replace function public.pvp_gold_house_store(p_player text, p_cottage text, p_qty integer, p_req text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pid text := public.pvp_main(p_player); h pvp_houses; prev pvp_purchases;
  q integer; used integer; dest integer; stack_slot integer; room integer;
  g_before integer; g_after integer; is_wallet boolean := pid like 'wallet:%';
  rv integer;
begin
  if not pvp_flag('houses') or not pvp_flag('gold_item') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  if p_cottage is null or p_cottage !~ '^[a-z0-9_]{2,24}$' or p_req is null or char_length(p_req) < 16 or char_length(p_req) > 64 then
    return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
  if p_qty is null or p_qty < 1 or p_qty > 10000000 then return jsonb_build_object('ok', false, 'why', 'bad qty'); end if;

  select * into prev from pvp_purchases where req = p_req;
  if found then
    if prev.player_id <> pid then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
    return jsonb_build_object('ok', true, 'retry', true, 'gold', prev.gold_after, 'rev', prev.rev, 'item', 'val:gold', 'qty', prev.price);
  end if;

  if p_cottage = 'ship_quarters' then perform public.pvp_ensure_ship_quarters(pid); end if;
  select * into h from pvp_houses where player_id = pid and cottage_id = p_cottage for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'not owned'); end if;
  if not pvp_rl_hit('gstore:' || pid, 60, 20) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;

  select slot, qty into stack_slot, room from pvp_house_storage
    where player_id = pid and cottage_id = p_cottage and item = 'val:gold'
    order by slot limit 1 for update;
  if stack_slot is not null then room := 10000000 - room; else room := 10000000; end if;
  if room < 1 then return jsonb_build_object('ok', false, 'why', 'chest full'); end if;

  select count(*) into used from pvp_house_storage where player_id = pid and cottage_id = p_cottage;
  if stack_slot is null and used >= h.slots then return jsonb_build_object('ok', false, 'why', 'chest full'); end if;

  q := least(p_qty, room);

  if is_wallet then select gold, shop_rev into g_before, rv from pvp_profiles where id = pid for update;
  else select gold, shop_rev into g_before, rv from pvp_dev_profiles where id = pid for update; end if;
  if not found then return jsonb_build_object('ok', false, 'why', 'no save yet'); end if;
  if g_before < 1 then return jsonb_build_object('ok', false, 'why', 'not enough gold', 'gold', g_before); end if;
  q := least(q, g_before);
  if q < 1 then return jsonb_build_object('ok', false, 'why', 'not enough gold', 'gold', g_before); end if;

  g_after := g_before - q; rv := coalesce(rv, 0) + 1;
  if is_wallet then update pvp_profiles set gold = g_after, shop_rev = rv where id = pid;
  else update pvp_dev_profiles set gold = g_after, shop_rev = rv where id = pid; end if;

  if stack_slot is not null then
    update pvp_house_storage set qty = qty + q, updated_at = now()
      where player_id = pid and cottage_id = p_cottage and slot = stack_slot;
    dest := stack_slot;
  else
    select min(gs) into dest from generate_series(0, h.slots - 1) gs
      where not exists (select 1 from pvp_house_storage s
        where s.player_id = pid and s.cottage_id = p_cottage and s.slot = gs);
    if dest is null then
      -- rollback gold
      if is_wallet then update pvp_profiles set gold = g_before, shop_rev = rv - 1 where id = pid;
      else update pvp_dev_profiles set gold = g_before, shop_rev = rv - 1 where id = pid; end if;
      return jsonb_build_object('ok', false, 'why', 'chest full');
    end if;
    insert into pvp_house_storage (player_id, cottage_id, slot, item, qty, meta)
      values (pid, p_cottage, dest, 'val:gold', q, jsonb_build_object('src', 'gold'));
  end if;

  insert into pvp_purchases (player_id, req, item, price, gold_before, gold_after, rev)
    values (pid, p_req, 'gold_store:' || p_cottage, q, g_before, g_after, rv);
  insert into pvp_inv_log (player_id, item, delta, source, why, ref, gold)
    values (pid, 'val:gold', q, 'gold', 'house_store', p_cottage, -q);

  return jsonb_build_object('ok', true, 'item', 'val:gold', 'qty', q, 'slot', dest,
    'gold', g_after, 'rev', rv, 'cottage', p_cottage);
end $$;
revoke all on function public.pvp_gold_house_store(text, text, integer, text) from public, anon, authenticated;
grant execute on function public.pvp_gold_house_store(text, text, integer, text) to service_role;

-- ---------- withdraw chest gold back to spendable balance (never into pvp_inv) ----------
create or replace function public.pvp_gold_house_take(p_player text, p_cottage text, p_slot integer, p_qty integer, p_req text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pid text := public.pvp_main(p_player); r pvp_house_storage; prev pvp_purchases;
  q integer; g_before integer; g_after integer; is_wallet boolean := pid like 'wallet:%'; rv integer;
begin
  if not pvp_flag('houses') or not pvp_flag('gold_item') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  if p_cottage is null or p_req is null or char_length(p_req) < 16 or char_length(p_req) > 64 then
    return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
  if p_slot is null or p_slot < 0 or p_slot > 119 then return jsonb_build_object('ok', false, 'why', 'bad take'); end if;

  select * into prev from pvp_purchases where req = p_req;
  if found then
    if prev.player_id <> pid then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
    return jsonb_build_object('ok', true, 'retry', true, 'gold', prev.gold_after, 'rev', prev.rev, 'item', 'val:gold', 'qty', prev.price);
  end if;

  if p_cottage = 'ship_quarters' then perform public.pvp_ensure_ship_quarters(pid); end if;
  select * into r from pvp_house_storage where player_id = pid and cottage_id = p_cottage and slot = p_slot for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'empty'); end if;
  if r.item <> 'val:gold' then return jsonb_build_object('ok', false, 'why', 'not gold'); end if;
  if not pvp_rl_hit('gtake:' || pid, 60, 20) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;

  q := greatest(1, least(coalesce(p_qty, r.qty), r.qty, 10000000));

  if is_wallet then select gold, shop_rev into g_before, rv from pvp_profiles where id = pid for update;
  else select gold, shop_rev into g_before, rv from pvp_dev_profiles where id = pid for update; end if;
  if not found then return jsonb_build_object('ok', false, 'why', 'no save yet'); end if;

  -- Cap credit so balance never exceeds 10_000_000
  q := least(q, greatest(0, 10000000 - g_before));
  if q < 1 then return jsonb_build_object('ok', false, 'why', 'gold full', 'gold', g_before); end if;

  g_after := g_before + q; rv := coalesce(rv, 0) + 1;
  if is_wallet then update pvp_profiles set gold = g_after, shop_rev = rv where id = pid;
  else update pvp_dev_profiles set gold = g_after, shop_rev = rv where id = pid; end if;

  if q >= r.qty then delete from pvp_house_storage where player_id = pid and cottage_id = p_cottage and slot = p_slot;
  else update pvp_house_storage set qty = qty - q, updated_at = now()
    where player_id = pid and cottage_id = p_cottage and slot = p_slot; end if;

  insert into pvp_purchases (player_id, req, item, price, gold_before, gold_after, rev)
    values (pid, p_req, 'gold_take:' || p_cottage || ':' || p_slot, q, g_before, g_after, rv);
  insert into pvp_inv_log (player_id, item, delta, source, why, ref, gold)
    values (pid, 'val:gold', -q, 'gold', 'house_take', p_cottage, q);

  return jsonb_build_object('ok', true, 'item', 'val:gold', 'qty', q, 'slot', p_slot,
    'gold', g_after, 'rev', rv, 'cottage', p_cottage);
end $$;
revoke all on function public.pvp_gold_house_take(text, text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.pvp_gold_house_take(text, text, integer, integer, text) to service_role;

-- ---------- give spendable gold to another pirate (balance → balance) ----------
create or replace function public.pvp_gold_gift(p_from text, p_to text, p_qty integer, p_req text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a text := public.pvp_main(p_from); b text := public.pvp_main(p_to); prev pvp_purchases;
  q integer; ga integer; gb integer; rva integer; rvb integer;
  a_wallet boolean := a like 'wallet:%'; b_wallet boolean := b like 'wallet:%';
begin
  if not pvp_flag('gift') or not pvp_flag('gold_item') then return jsonb_build_object('ok', false, 'why', 'gifts closed'); end if;
  if b is null or b = a then return jsonb_build_object('ok', false, 'why', 'not to yourself'); end if;
  if p_req is null or char_length(p_req) < 16 or char_length(p_req) > 64 then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
  if p_qty is null or p_qty < 1 or p_qty > 10000000 then return jsonb_build_object('ok', false, 'why', 'bad qty'); end if;

  select * into prev from pvp_purchases where req = p_req;
  if found then
    if prev.player_id <> a then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
    return jsonb_build_object('ok', true, 'retry', true, 'gold', prev.gold_after, 'rev', prev.rev, 'to', b, 'item', 'val:gold', 'qty', prev.price);
  end if;

  if not exists (select 1 from pvp_players where id = b)
     and not exists (select 1 from pvp_dev_profiles where id = b)
     and not exists (select 1 from pvp_profiles where id = b)
     and b <> pvp_inv_owner()
    then return jsonb_build_object('ok', false, 'why', 'no such pirate'); end if;

  if not pvp_rl_hit('ggift:' || a, 60, 6) or not pvp_rl_hit('ggiftd:' || a, 86400, 100) then
    return jsonb_build_object('ok', false, 'why', 'slow down'); end if;

  -- Lock sender then recipient (id order avoids deadlocks when both gift)
  if a < b then
    if a_wallet then select gold, shop_rev into ga, rva from pvp_profiles where id = a for update;
    else select gold, shop_rev into ga, rva from pvp_dev_profiles where id = a for update; end if;
    if b_wallet then select gold, shop_rev into gb, rvb from pvp_profiles where id = b for update;
    else
      insert into pvp_dev_profiles (id) values (b) on conflict do nothing;
      select gold, shop_rev into gb, rvb from pvp_dev_profiles where id = b for update;
    end if;
  else
    if b_wallet then select gold, shop_rev into gb, rvb from pvp_profiles where id = b for update;
    else
      insert into pvp_dev_profiles (id) values (b) on conflict do nothing;
      select gold, shop_rev into gb, rvb from pvp_dev_profiles where id = b for update;
    end if;
    if a_wallet then select gold, shop_rev into ga, rva from pvp_profiles where id = a for update;
    else select gold, shop_rev into ga, rva from pvp_dev_profiles where id = a for update; end if;
  end if;

  if ga is null then return jsonb_build_object('ok', false, 'why', 'no save yet'); end if;
  if b_wallet and gb is null then return jsonb_build_object('ok', false, 'why', 'no such pirate'); end if;
  if gb is null then gb := 0; rvb := 0; end if;
  q := least(p_qty, ga, greatest(0, 10000000 - gb));
  if q < 1 then
    if ga < 1 then return jsonb_build_object('ok', false, 'why', 'not enough gold', 'gold', ga); end if;
    return jsonb_build_object('ok', false, 'why', 'their gold full'); end if;

  rva := coalesce(rva, 0) + 1; rvb := coalesce(rvb, 0) + 1;
  if a_wallet then update pvp_profiles set gold = ga - q, shop_rev = rva where id = a;
  else update pvp_dev_profiles set gold = ga - q, shop_rev = rva where id = a; end if;
  if b_wallet then update pvp_profiles set gold = gb + q, shop_rev = rvb where id = b;
  else update pvp_dev_profiles set gold = gb + q, shop_rev = rvb where id = b; end if;

  insert into pvp_purchases (player_id, req, item, price, gold_before, gold_after, rev)
    values (a, p_req, 'gold_gift:' || b, q, ga, ga - q, rva);
  insert into pvp_inv_log (player_id, item, delta, source, why, ref, gold)
    values (a, 'val:gold', -q, 'gold', 'gift_out', b, -q),
           (b, 'val:gold', q, 'gold', 'gift_in', a, q);

  return jsonb_build_object('ok', true, 'to', b, 'item', 'val:gold', 'qty', q,
    'gold', ga - q, 'rev', rva, 'their_gold', gb + q);
end $$;
revoke all on function public.pvp_gold_gift(text, text, integer, text) from public, anon, authenticated;
grant execute on function public.pvp_gold_gift(text, text, integer, text) to service_role;

commit;
