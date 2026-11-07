-- [musket-levels] BANKSY t2084u "Give muskets levels too where they can only buy level 1 of 2 models and can only find level 1 of the 2
-- other models then they can upgrade them" + card answer "Rarity goes up every 5 levels". Server half of js/inventory/catalog.js
-- MUSKET_* (keep in sync; tests/musketLevels.test.mjs runs this file in PGlite and checks it against the catalog).
--   * A musket copy's LEVEL lives in its item key, so it travels with that copy through gifts, the Marketplace, cottage chests, loot bags:
--       LV 1 / 6 / 11 / 16 = the OLD keys wpn:musket:<base>:common / rare / epic / legendary (nothing anyone owns changes: an old common
--       musket is LV 1, rare LV 6, epic LV 11, legendary LV 16), every other level = wpn:musket:<base>:<rarity>:<lv>.
--       Rarity = the level band: COMMON 1-5 · RARE 6-10 · EPIC 11-15 · LEGENDARY 16-20 (max).
--   * pvp_inv_musk_level: one copy -> the next level for gold (+ MUSKET PARTS at a rarity step). The copy keeps its provenance (a gold-bought
--     'carry_buy' copy stays un-resellable, a found one stays tradeable), its fitted attachments (pvp_gun_inst) and its EQUIPPED place.
--   * The old RANK UP (042 / 047) is closed while musket_levels is on (a level-up replaces it); SALVAGE also takes levelled copies.
-- ADDITIVE: the pvp_inv / pvp_gun_inst CHECKs gain the levelled keys (every existing row still passes), new price rows, new functions,
-- two existing functions replaced (pvp_inv_musk_rank: + one flag line; pvp_inv_musk_salvage: + the levelled key pattern). No row is
-- updated or deleted. Backup before applying: tools/inventory/backup_036.sh (pvp_inv, pvp_inv_equip, pvp_profiles, pvp_dev_profiles).
begin;
insert into public.pvp_flags (k, on_, note) values ('musket_levels', true, 'musket levels 1-20, rarity every 5 levels (061)') on conflict (k) do nothing;

-- the exact canonical levelled-key tail (LV 2-5 common, 7-10 rare, 12-15 epic, 17-20 legendary); LV 1/6/11/16 keep the old 4-part key
alter table public.pvp_inv drop constraint if exists pvp_inv_item_check;
alter table public.pvp_inv add constraint pvp_inv_item_check check (item ~ '^(fish:[a-z_]{2,16}|val:[a-z_]{2,20}|wpn:(sword|musket):[a-z_]{2,16}:(common|rare|epic|legendary)|wpn:musket:[a-z_]{2,16}:(common:[2-5]|rare:([7-9]|10)|epic:1[2-5]|legendary:(1[7-9]|20))|dup:[a-z]{2,10}:[a-z0-9_]{2,24}:(common|uncommon|rare|epic|legendary)|isl:[a-z_]{2,24}|par:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$');
alter table public.pvp_gun_inst drop constraint if exists pvp_gun_inst_item_chk;
alter table public.pvp_gun_inst add constraint pvp_gun_inst_item_chk check (item ~ '^wpn:musket:[a-z_]{2,16}:((common|rare|epic|legendary)|common:[2-5]|rare:([7-9]|10)|epic:1[2-5]|legendary:(1[7-9]|20))$');

-- level <-> key (= catalog.js muskTierOf / muskKeyAt / muskLevelOf)
create or replace function public.pvp_musk_tier(p_lv integer) returns text language sql immutable as $$
  select (array['common','rare','epic','legendary'])[least(4, greatest(1, (greatest(1, p_lv) - 1) / 5 + 1))] $$;
create or replace function public.pvp_musk_key(p_base text, p_lv integer) returns text language sql immutable as $$
  select 'wpn:musket:' || p_base || ':' || pvp_musk_tier(p_lv) || case when (p_lv - 1) % 5 = 0 then '' else ':' || p_lv end $$;
create or replace function public.pvp_musk_lv(p_item text) returns integer language plpgsql immutable as $$
declare m text[]; lv integer;
begin
  m := regexp_match(coalesce(p_item, ''), '^wpn:musket:([a-z_]{2,16}):(common|rare|epic|legendary)(?::([0-9]{1,2}))?$');
  if m is null then return null; end if;
  lv := coalesce(m[3]::int, case m[2] when 'common' then 1 when 'rare' then 6 when 'epic' then 11 else 16 end);
  if lv not between 1 and 20 or pvp_musk_key(m[1], lv) <> p_item then return null; end if;
  return lv;
end $$;
-- gold + parts from LV p_lv to p_lv + 1 (= catalog.js muskLevelCost): 200 g x level; a rarity step = the old rank-up price
create or replace function public.pvp_musk_lv_cost(p_lv integer, out gold integer, out parts integer) language sql immutable as $$
  select case p_lv when 5 then 1500 when 10 then 4000 when 15 then 10000 else 200 * p_lv end,
         case p_lv when 5 then 3 when 10 then 6 when 15 then 12 else 0 end $$;

-- the Treasure Trader buys every level of every musket base at its rarity's price (= catalog.js musketLevelPriceRows; 036 rows untouched)
insert into public.pvp_inv_prices (item, shop, price)
  select pvp_musk_key(b, lv), 'antiques', case pvp_musk_tier(lv) when 'common' then 500 when 'rare' then 2000 when 'epic' then 3500 else 5000 end
  from unnest(array['rusty', 'navy', 'blunder', 'dragoon', 'bone']) b, generate_series(1, 20) lv
  on conflict (item, shop) do nothing;

-- LEVEL UP one musket copy. p_gid (optional) = the exact copy (its attachments + equipped place follow it); owner = free (like rank-up).
create or replace function public.pvp_inv_musk_level(p_player text, p_item text, p_gid uuid, p_owner boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); lv integer := pvp_musk_lv(p_item); base text := split_part(p_item, ':', 3);
  c record; out_item text; src text; have integer; g pvp_gun_inst; was_eq boolean := false; left_n integer;
begin
  if not pvp_flag('musket_levels') then return jsonb_build_object('ok', false, 'why', 'levels closed'); end if;
  if lv is null then return jsonb_build_object('ok', false, 'why', 'bad item'); end if;
  if lv >= 20 then return jsonb_build_object('ok', false, 'why', 'max level'); end if;
  if not pvp_rl_hit('mlvl:' || pid, 2, 2) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  select * into c from pvp_musk_lv_cost(lv); out_item := pvp_musk_key(base, lv + 1);
  -- one copy, ANY provenance (a gold-bought musket levels up too); found / gifted copies first, the source rides along
  select source, qty into src, have from pvp_inv where player_id = pid and item = p_item
    order by case source when 'carry_buy' then 1 else 0 end, source limit 1 for update;
  if src is null then return jsonb_build_object('ok', false, 'why', 'not enough'); end if;
  if have <= 1 then delete from pvp_inv where player_id = pid and item = p_item and source = src;
  else update pvp_inv set qty = qty - 1, updated_at = now() where player_id = pid and item = p_item and source = src; end if;
  insert into pvp_inv_log (player_id, item, delta, source, why, ref) values (pid, p_item, -1, src, 'musk_level', out_item);
  if not p_owner then
    if c.parts > 0 and pvp_inv_take(pid, 'val:musket_parts', c.parts, 'musk_level', p_item) is null then raise exception 'not enough parts' using errcode = 'P0001'; end if;
    if not pvp_inv_gold(pid, -c.gold) then raise exception 'not enough gold' using errcode = 'P0001'; end if;
  end if;
  perform pvp_inv_add(pid, out_item, 1, src, 'musk_level', p_item);
  -- the copy's instance (attachments) follows: the asked gid, else a bag copy, else the equipped one
  select * into g from pvp_gun_inst where player_id = pid and item = p_item and place in ('bag', 'equip')
    order by (gid = p_gid) desc nulls last, case place when 'bag' then 0 else 1 end, updated_at limit 1 for update;
  if found then was_eq := g.place = 'equip'; update pvp_gun_inst set item = out_item, updated_at = now() where gid = g.gid; end if;
  select coalesce(sum(qty), 0) into left_n from pvp_inv where player_id = pid and item = p_item;
  update pvp_inv_equip set item = out_item where player_id = pid and slot = 'musket' and item = p_item and (was_eq or left_n = 0);
  return jsonb_build_object('ok', true, 'item', out_item, 'from', p_item, 'level', lv + 1, 'rarity', pvp_musk_tier(lv + 1), 'gid', g.gid,
    'price', case when p_owner then 0 else c.gold end, 'parts', case when p_owner then 0 else c.parts end);
exception when sqlstate 'P0001' then return jsonb_build_object('ok', false, 'why', sqlerrm); -- the whole call rolls back (nothing taken)
end $$;

-- the old RANK UP (047 body + the first line): closed while levels are on, a level-up replaces it
create or replace function public.pvp_inv_musk_rank(p_player text, p_item text, p_gold integer, p_parts integer, p_owner boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); cur text := split_part(p_item, ':', 4); nxt text; base text := split_part(p_item, ':', 3); out_item text;
begin
  if pvp_flag('musket_levels') then return jsonb_build_object('ok', false, 'why', 'use level up'); end if;
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
  perform pvp_gun_rank_follow(pid, p_item, out_item);
  update pvp_inv_equip set item = out_item where player_id = pid and slot = 'musket' and item = p_item
    and not exists (select 1 from pvp_inv where player_id = pid and item = p_item);
  return jsonb_build_object('ok', true, 'item', out_item, 'from', p_item, 'price', case when p_owner then 0 else p_gold end, 'parts', case when p_owner then 0 else p_parts end);
exception when sqlstate 'P0001' then return jsonb_build_object('ok', false, 'why', sqlerrm);
end $$;

-- SALVAGE (047 body; the item test now takes any valid musket level)
create or replace function public.pvp_inv_musk_salvage(p_player text, p_item text, p_parts integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); have integer; ret jsonb;
begin
  if not pvp_flag('musket_rank') then return jsonb_build_object('ok', false, 'why', 'rank closed'); end if;
  if pvp_musk_lv(p_item) is null or p_parts not between 1 and 20 then return jsonb_build_object('ok', false, 'why', 'bad item'); end if;
  if not pvp_rl_hit('msalv:' || pid, 2, 1) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  select coalesce(sum(qty), 0) into have from pvp_inv where player_id = pid and item = p_item;
  if have <= 1 and exists (select 1 from pvp_inv_equip where player_id = pid and slot = 'musket' and item = p_item) then return jsonb_build_object('ok', false, 'why', 'equipped'); end if;
  ret := pvp_gun_return_acc(pid, p_item);
  if pvp_inv_take(pid, p_item, 1, 'musk_salvage') is null then return jsonb_build_object('ok', false, 'why', 'not enough'); end if;
  perform pvp_inv_add(pid, 'val:musket_parts', p_parts, 'find', 'musk_salvage', p_item);
  return jsonb_build_object('ok', true, 'parts', p_parts, 'returned', coalesce(ret->'items', '[]'::jsonb));
end $$;

revoke all on function public.pvp_musk_lv(text), public.pvp_musk_key(text, integer), public.pvp_musk_tier(integer), public.pvp_musk_lv_cost(integer),
  public.pvp_inv_musk_level(text, text, uuid, boolean), public.pvp_inv_musk_rank(text, text, integer, integer, boolean), public.pvp_inv_musk_salvage(text, text, integer)
  from public, anon, authenticated;
commit;
