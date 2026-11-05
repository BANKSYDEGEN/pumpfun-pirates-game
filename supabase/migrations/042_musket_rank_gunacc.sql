-- [Emerly musket-rank + gunacc] BANKSY Nov 5 2:56 PM / 2:58 PM. ADDITIVE ONLY: new functions + one new flag row. No table, column, CHECK
-- or existing function is changed; no row is updated or deleted except the ones these functions move (each move is logged in pvp_inv_log).
--   * MUSKET RANK-UP: one found musket copy (tradeable, never a gold-bought 'carry_buy' one) -> the next rarity, for gold + 'val:musket_parts'.
--   * SALVAGE: one spare musket copy -> musket parts (never the copy you have equipped while it's your last one).
--   * GUN ACCESSORIES: bought for gold into the inventory ('val:acc_*'), or dropped by chests / fishing with musket parts.
-- Keys fit the existing pvp_inv CHECK (val:[a-z_]{2,20}); sources reuse 'chest' / 'find'. Behind pvp_flags 'musket_rank' (off until BANKSY).
-- Backup before applying: tools/inventory/backup_036.sh (pvp_inv, pvp_inv_equip, pvp_profiles, pvp_dev_profiles).
begin;
insert into public.pvp_flags (k, on_, note) values ('musket_rank', false, 'musket rank-up / salvage / gun accessories (042)') on conflict (k) do nothing;

-- rank-up: costs are passed by the Edge Function (inventory.ts RANK_UP, = js/musketUpgrades.js), checked again here
create or replace function public.pvp_inv_musk_rank(p_player text, p_item text, p_gold integer, p_parts integer, p_owner boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); cur text := split_part(p_item, ':', 4); nxt text; base text := split_part(p_item, ':', 3); out_item text;
begin
  if not pvp_flag('musket_rank') then return jsonb_build_object('ok', false, 'why', 'rank closed'); end if;
  if p_item !~ '^wpn:musket:[a-z_]{2,16}:(common|rare|epic)$' or p_gold < 0 or p_parts < 0 then return jsonb_build_object('ok', false, 'why', 'bad item'); end if;
  if not pvp_rl_hit('mrank:' || pid, 3, 1) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  nxt := case cur when 'common' then 'rare' when 'rare' then 'epic' else 'legendary' end; out_item := 'wpn:musket:' || base || ':' || nxt;
  if pvp_inv_take(pid, p_item, 1, 'musk_rank') is null then return jsonb_build_object('ok', false, 'why', 'not enough'); end if;
  if not p_owner then
    if p_parts > 0 and pvp_inv_take(pid, 'val:musket_parts', p_parts, 'musk_rank') is null then raise exception 'not enough parts' using errcode = 'P0001'; end if;
    if not pvp_inv_gold(pid, -p_gold) then raise exception 'not enough gold' using errcode = 'P0001'; end if;
  end if;
  perform pvp_inv_add(pid, out_item, 1, 'chest', 'musk_rank', p_item);
  update pvp_inv_equip set item = out_item where player_id = pid and slot = 'musket' and item = p_item
    and not exists (select 1 from pvp_inv where player_id = pid and item = p_item); -- the equipped copy was the one ranked: follow it
  return jsonb_build_object('ok', true, 'item', out_item, 'from', p_item, 'price', case when p_owner then 0 else p_gold end, 'parts', case when p_owner then 0 else p_parts end);
exception when sqlstate 'P0001' then return jsonb_build_object('ok', false, 'why', sqlerrm); -- the whole call rolls back (nothing taken)
end $$;

create or replace function public.pvp_inv_musk_salvage(p_player text, p_item text, p_parts integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); have integer;
begin
  if not pvp_flag('musket_rank') then return jsonb_build_object('ok', false, 'why', 'rank closed'); end if;
  if p_item !~ '^wpn:musket:[a-z_]{2,16}:(common|rare|epic|legendary)$' or p_parts not between 1 and 20 then return jsonb_build_object('ok', false, 'why', 'bad item'); end if;
  if not pvp_rl_hit('msalv:' || pid, 2, 1) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  select coalesce(sum(qty), 0) into have from pvp_inv where player_id = pid and item = p_item;
  if have <= 1 and exists (select 1 from pvp_inv_equip where player_id = pid and slot = 'musket' and item = p_item) then return jsonb_build_object('ok', false, 'why', 'equipped'); end if;
  if pvp_inv_take(pid, p_item, 1, 'musk_salvage') is null then return jsonb_build_object('ok', false, 'why', 'not enough'); end if;
  perform pvp_inv_add(pid, 'val:musket_parts', p_parts, 'find', 'musk_salvage', p_item);
  return jsonb_build_object('ok', true, 'parts', p_parts);
end $$;

create or replace function public.pvp_inv_buy_acc(p_player text, p_item text, p_price integer, p_owner boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player);
begin
  if not pvp_flag('musket_rank') then return jsonb_build_object('ok', false, 'why', 'shop closed'); end if;
  if p_item not in ('val:acc_scope', 'val:acc_bayonet', 'val:acc_stock', 'val:acc_horn') or p_price not between 1 and 100000 then return jsonb_build_object('ok', false, 'why', 'bad item'); end if;
  if not pvp_rl_hit('macc:' || pid, 2, 1) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  if not p_owner and not pvp_inv_gold(pid, -p_price) then return jsonb_build_object('ok', false, 'why', 'not enough gold'); end if;
  perform pvp_inv_add(pid, p_item, 1, 'chest', 'acc_buy');
  return jsonb_build_object('ok', true, 'item', p_item, 'price', case when p_owner then 0 else p_price end);
end $$;

-- chest / fishing extras (parts + accessories), rolled by the Edge Function; once per ref (map id / catch ticket)
create or replace function public.pvp_inv_gun_drop(p_player text, p_ref text, p_items jsonb, p_source text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); e jsonb; n integer; got jsonb := '[]'::jsonb;
begin
  if not pvp_flag('musket_rank') or p_source not in ('chest', 'fish') or p_ref !~ '^[A-Za-z0-9:_-]{4,80}$' then return jsonb_build_object('ok', true, 'items', got); end if;
  insert into pvp_inv_once (player_id, k) values (pid, 'gun:' || p_ref) on conflict do nothing; get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', true, 'items', got); end if;
  for e in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if (e->>'item') in ('val:musket_parts', 'val:acc_scope', 'val:acc_bayonet', 'val:acc_stock', 'val:acc_horn') and coalesce((e->>'qty')::int, 0) between 1 and 5 then
      perform pvp_inv_add(pid, e->>'item', (e->>'qty')::int, p_source, 'gun_drop', p_ref); got := got || jsonb_build_array(e); end if;
  end loop;
  return jsonb_build_object('ok', true, 'items', got);
end $$;
revoke all on function public.pvp_inv_musk_rank(text, text, integer, integer, boolean), public.pvp_inv_musk_salvage(text, text, integer), public.pvp_inv_buy_acc(text, text, integer, boolean), public.pvp_inv_gun_drop(text, text, jsonb, text) from public, anon, authenticated;
commit;
