-- PUMPFUN PIRATES · migration 036 (post/inventory-fish): THE INVENTORY (BANKSY 11:01-11:19 AM, via Emerly).
-- ADDITIVE ONLY: new tables + new functions + one new nullable column. Nothing a player already has is altered or removed:
-- pvp_owned, pvp_maps rows, gold, boards, kills stay as they are. 026 pvp_map_dig + 035 pvp_map_dig_item are NOT replaced (the new Edge
-- Function calls the NEW pvp_map_dig_inv; an old Edge Function keeps calling the old ones = nothing changes until both ship).
--   * pvp_inv: what each pirate HOLDS (item, provenance source, qty; identical items stack). Unlimited, no slot / stack cap.
--   * pvp_flags: every sell / market / weapon flag, read SERVER-side (all OFF except the inventory + gifting).
--   * pvp_inv_prices: the NPC prices (js/inventory/catalog.js; Antiques = BANKSY's approved 11:19 values, Fish = proposal).
--   * pvp_inv_sell(p_player, p_item, p_qty, p_shop, p_mult): THE ONE NPC payout (Fish Stand + Antiques): atomic take + pay,
--     gold = floor(base x qty x clamp(p_mult, 1.0, 1.40)); p_mult = 1 + boostsOf(gear, owned).sell, computed by the Edge Function from
--     server rows (Raul's pet SELL bonus; 1.0 until his branch lands). No cap on the payout itself (BANKSY 11:40: pets can push > 5,000).
--   * pvp_inv_gift: atomic giver -> receiver, rate-limited, no self-gifts, recipient must exist.
--   * pvp_mkt_*: the player Marketplace: escrowed listings, one-transaction buys with a row lock (no double buys), cancel, caps, limits.
--   * pvp_map_dig_inv: a dig pays ITEMS only (no chest gold): valuables / weapons / cosmetics, rolled by the Edge Function from the map id.
--   * pvp_fish_catch / pvp_inv_find: server-side fish + island finds (rate-limited) so they can be traded at all.
--   * pvp_inv_carry: swords + muskets you OWN show up in the inventory (pvp_owned is untouched; gold-bought = never resold).
--   * pvp_inv_owner_kit: the OWNER's one-time test kit (~3 of everything), idempotent, owner id only.
-- Backup before applying: tools/inventory/backup_036.sh (pvp_profiles, pvp_dev_profiles, pvp_owned, pvp_maps, pvp_map_loot -> /workspace/backups).
begin;
create table if not exists public.pvp_flags (k text primary key, on_ boolean not null, note text, updated_at timestamptz not null default now());
insert into public.pvp_flags (k, on_, note) values
  ('inv', true, 'inventory grid'), ('fish_sell', false, 'Fish Stand pays gold (proposal prices)'), ('antiques_sell', false, 'Antiques pays gold (BANKSY 11:19 prices)'),
  ('gift', true, 'gifting'), ('market', false, 'player Marketplace'), ('market_fee', false, 'sales tax gold sink'),
  ('weapon_stats', false, 'rarity stats'), ('rare_weapon_drops', false, 'rare+ weapons in chests'), ('test_only_lock', false, 'owner kit copies locked (BANKSY 11:18: off)')
  on conflict (k) do nothing;
create or replace function public.pvp_flag(p_k text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select on_ from pvp_flags where k = p_k), false) $$;

create table if not exists public.pvp_inv (
  player_id  text not null,
  item       text not null check (item ~ '^(fish:[a-z_]{2,16}|val:[a-z_]{2,20}|wpn:(sword|musket):[a-z_]{2,16}:(common|rare|epic|legendary)|dup:[a-z]{2,10}:[a-z0-9_]{2,24}:(common|uncommon|rare|epic|legendary))$'),
  source     text not null check (source in ('fish', 'chest', 'find', 'gift', 'market', 'kit', 'carry_buy', 'carry_grant')),
  qty        integer not null check (qty > 0 and qty <= 1000000),
  updated_at timestamptz not null default now(),
  primary key (player_id, item, source)
);
create table if not exists public.pvp_inv_log (           -- append-only audit of every inventory move
  id bigserial primary key, player_id text not null, item text not null, delta integer not null, source text, why text not null, ref text, gold integer, created_at timestamptz not null default now());
create index if not exists pvp_inv_log_player_idx on public.pvp_inv_log (player_id, created_at desc);
create table if not exists public.pvp_inv_prices (item text not null, shop text not null check (shop in ('fish', 'antiques')), price integer not null check (price between 0 and 100000), primary key (item, shop));
create table if not exists public.pvp_inv_rarity_prices (rarity text primary key, price integer not null);
create table if not exists public.pvp_inv_owner_pot (player_id text primary key, gold bigint not null default 0, updated_at timestamptz not null default now()); -- gold waiting for a pirate: Marketplace proceeds (seller offline) + the OWNER's sales (his gold lives on the group save); pvp_inv_pot_take collects
create table if not exists public.pvp_inv_once (player_id text not null, k text not null, created_at timestamptz not null default now(), primary key (player_id, k)); -- idempotent grants / daily finds
create table if not exists public.pvp_inv_equip (player_id text not null, slot text not null check (slot in ('sword', 'musket')), item text not null, primary key (player_id, slot));
create table if not exists public.pvp_mkt_listings (
  id bigserial primary key, seller_id text not null, item text not null, qty integer not null check (qty > 0), price integer not null check (price > 0),
  source text not null, status text not null default 'open' check (status in ('open', 'sold', 'cancelled')), buyer_id text, fee integer not null default 0,
  created_at timestamptz not null default now(), closed_at timestamptz);
create index if not exists pvp_mkt_open_idx on public.pvp_mkt_listings (status, created_at desc);
create index if not exists pvp_mkt_seller_idx on public.pvp_mkt_listings (seller_id, status);
alter table public.pvp_maps add column if not exists via text;   -- 'gift' / 'market' / 'sold' / 'kit' (a moved map); null = as dropped
alter table public.pvp_flags enable row level security; alter table public.pvp_inv enable row level security; alter table public.pvp_inv_log enable row level security;
alter table public.pvp_inv_prices enable row level security; alter table public.pvp_inv_rarity_prices enable row level security; alter table public.pvp_inv_owner_pot enable row level security;
alter table public.pvp_inv_once enable row level security; alter table public.pvp_inv_equip enable row level security; alter table public.pvp_mkt_listings enable row level security;
revoke all on public.pvp_flags, public.pvp_inv, public.pvp_inv_log, public.pvp_inv_prices, public.pvp_inv_rarity_prices, public.pvp_inv_owner_pot, public.pvp_inv_once, public.pvp_inv_equip, public.pvp_mkt_listings from public, anon, authenticated;

insert into public.pvp_inv_rarity_prices values ('common', 500), ('uncommon', 1000), ('rare', 2000), ('epic', 3500), ('legendary', 5000) on conflict do nothing;
insert into public.pvp_inv_prices (item, shop, price) values
  ('map', 'antiques', 100),
  ('fish:minnow','fish',15),
  ('fish:perch','fish',25),
  ('fish:snapper','fish',45),
  ('fish:eel','fish',70),
  ('fish:pike','fish',100),
  ('fish:carp','fish',180),
  ('fish:koi','fish',300),
  ('fish:leviathan','fish',1000),
  ('val:silver_ring','antiques',500),
  ('val:idol_shard','antiques',500),
  ('val:river_pearl','antiques',500),
  ('val:gold_bar','antiques',1000),
  ('val:pearl_necklace','antiques',1200),
  ('val:ruby','antiques',2000),
  ('val:gem_ring','antiques',2200),
  ('val:diamond','antiques',3500),
  ('val:jewel_necklace','antiques',3500),
  ('val:crown_jewel','antiques',5000),
  ('wpn:sword:rusty:common','antiques',500),
  ('wpn:sword:rusty:rare','antiques',2000),
  ('wpn:sword:rusty:epic','antiques',3500),
  ('wpn:sword:rusty:legendary','antiques',5000),
  ('wpn:sword:cutlass:common','antiques',500),
  ('wpn:sword:cutlass:rare','antiques',2000),
  ('wpn:sword:cutlass:epic','antiques',3500),
  ('wpn:sword:cutlass:legendary','antiques',5000),
  ('wpn:sword:rapier:common','antiques',500),
  ('wpn:sword:rapier:rare','antiques',2000),
  ('wpn:sword:rapier:epic','antiques',3500),
  ('wpn:sword:rapier:legendary','antiques',5000),
  ('wpn:sword:bone:common','antiques',500),
  ('wpn:sword:bone:rare','antiques',2000),
  ('wpn:sword:bone:epic','antiques',3500),
  ('wpn:sword:bone:legendary','antiques',5000),
  ('wpn:musket:rusty:common','antiques',500),
  ('wpn:musket:rusty:rare','antiques',2000),
  ('wpn:musket:rusty:epic','antiques',3500),
  ('wpn:musket:rusty:legendary','antiques',5000),
  ('wpn:musket:navy:common','antiques',500),
  ('wpn:musket:navy:rare','antiques',2000),
  ('wpn:musket:navy:epic','antiques',3500),
  ('wpn:musket:navy:legendary','antiques',5000),
  ('wpn:musket:blunder:common','antiques',500),
  ('wpn:musket:blunder:rare','antiques',2000),
  ('wpn:musket:blunder:epic','antiques',3500),
  ('wpn:musket:blunder:legendary','antiques',5000),
  ('wpn:musket:dragoon:common','antiques',500),
  ('wpn:musket:dragoon:rare','antiques',2000),
  ('wpn:musket:dragoon:epic','antiques',3500),
  ('wpn:musket:dragoon:legendary','antiques',5000)
  on conflict do nothing;

-- ---------- internals (security definer, no grants: only the Edge Function's service role calls anything here) ----------
create or replace function public.pvp_inv_owner() returns text language sql immutable as $$ select 'dev:e191a32e15abea4f14355121'::text $$;
-- gold +/- for one pirate: wallet -> pvp_profiles, device -> pvp_dev_profiles, OWNER -> the pot (may go negative: his save pays it).
-- false = not enough gold (nothing changed)
create or replace function public.pvp_inv_gold(p_pid text, p_delta bigint) returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_delta = 0 then return true; end if;
  if p_pid = pvp_inv_owner() then
    insert into pvp_inv_owner_pot (player_id, gold) values (p_pid, p_delta) on conflict (player_id) do update set gold = pvp_inv_owner_pot.gold + p_delta, updated_at = now(); return true; end if;
  if p_pid like 'wallet:%' then update pvp_profiles set gold = least(10000000, gold + p_delta) where id = p_pid and gold + p_delta >= 0;
  else update pvp_dev_profiles set gold = least(10000000, gold + p_delta) where id = p_pid and gold + p_delta >= 0; end if;
  get diagnostics n = row_count; return n = 1;
end $$;
create or replace function public.pvp_inv_add(p_pid text, p_item text, p_qty integer, p_source text, p_why text, p_ref text default null) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into pvp_inv (player_id, item, source, qty) values (p_pid, p_item, p_source, p_qty)
    on conflict (player_id, item, source) do update set qty = pvp_inv.qty + excluded.qty, updated_at = now();
  insert into pvp_inv_log (player_id, item, delta, source, why, ref) values (p_pid, p_item, p_qty, p_source, p_why, p_ref);
end $$;
-- take p_qty of p_item, TRADEABLE copies only (never 'carry_buy' = gold-bought; 'kit' only while test_only_lock is off). Rows are locked
-- (FOR UPDATE), so two concurrent takes can't both spend the same stack. null = not enough (nothing changed).
create or replace function public.pvp_inv_take(p_pid text, p_item text, p_qty integer, p_why text, p_ref text default null) returns integer language plpgsql security definer set search_path = public as $$
declare r record; need integer := p_qty; have integer; k integer; lock_kit boolean := pvp_flag('test_only_lock');
begin
  if p_qty is null or p_qty < 1 then return null; end if;
  select coalesce(sum(qty), 0) into have from (select qty from pvp_inv where player_id = p_pid and item = p_item and source <> 'carry_buy' and not (lock_kit and source = 'kit') for update) s;
  if have < p_qty then return null; end if;
  for r in select source, qty from pvp_inv where player_id = p_pid and item = p_item and source <> 'carry_buy' and not (lock_kit and source = 'kit') order by case source when 'kit' then 0 else 1 end, source loop
    exit when need = 0; k := least(need, r.qty);
    if k = r.qty then delete from pvp_inv where player_id = p_pid and item = p_item and source = r.source;
    else update pvp_inv set qty = qty - k, updated_at = now() where player_id = p_pid and item = p_item and source = r.source; end if;
    insert into pvp_inv_log (player_id, item, delta, source, why, ref) values (p_pid, p_item, -k, r.source, p_why, p_ref);
    need := need - k;
  end loop;
  return p_qty;
end $$;
-- a treasure map (pvp_maps row) the pirate holds, undug, locked
create or replace function public.pvp_inv_map(p_pid text, p_item text) returns uuid language plpgsql security definer set search_path = public as $$
declare mid uuid; begin
  if p_item !~ '^map:[0-9a-f-]{36}$' then return null; end if;
  select id into mid from pvp_maps where id = substr(p_item, 5)::uuid and player_id = p_pid and dug_at is null for update;
  return mid; end $$;

-- ---------- THE NPC PAYOUT: Fish Stand ('fish') + Antiques ('antiques') ----------
create or replace function public.pvp_inv_sell(p_player text, p_item text, p_qty integer, p_shop text, p_mult numeric default 1.0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); base integer; m numeric := least(1.40, greatest(1.0, coalesce(p_mult, 1.0))); g bigint; mid uuid;
begin
  if p_shop not in ('fish', 'antiques') then return jsonb_build_object('ok', false, 'why', 'bad shop'); end if;
  if not pvp_flag(p_shop || '_sell') then return jsonb_build_object('ok', false, 'why', 'shop closed'); end if;
  if p_qty is null or p_qty < 1 or p_qty > 100000 then return jsonb_build_object('ok', false, 'why', 'bad qty'); end if;
  if not pvp_rl_hit('sell:' || pid, 10, 20) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  if p_item like 'map:%' then
    if p_shop <> 'antiques' or p_qty <> 1 then return jsonb_build_object('ok', false, 'why', 'not bought here'); end if;
    select price into base from pvp_inv_prices where item = 'map' and shop = 'antiques';
    mid := pvp_inv_map(pid, p_item); if mid is null then return jsonb_build_object('ok', false, 'why', 'not enough'); end if;
    update pvp_maps set player_id = 'gone:' || pid, via = 'sold' where id = mid;
    insert into pvp_inv_log (player_id, item, delta, why) values (pid, p_item, -1, 'sell:antiques');
  else
    select price into base from pvp_inv_prices where item = p_item and shop = p_shop;
    if base is null and p_shop = 'antiques' and p_item like 'dup:%' then select price into base from pvp_inv_rarity_prices where rarity = split_part(p_item, ':', 4); end if;
    if base is null then return jsonb_build_object('ok', false, 'why', 'not bought here'); end if;
    if pvp_inv_take(pid, p_item, p_qty, 'sell:' || p_shop) is null then return jsonb_build_object('ok', false, 'why', 'not enough'); end if;
  end if;
  g := floor(base::numeric * p_qty * m);
  perform pvp_inv_gold(pid, g);
  update pvp_inv_log set gold = g where id = (select max(id) from pvp_inv_log where player_id = pid);
  return jsonb_build_object('ok', true, 'gold', g, 'base', base, 'qty', p_qty, 'mult', m, 'owner', pid = pvp_inv_owner(),
    'left', (select coalesce(sum(qty), 0) from pvp_inv where player_id = pid and item = p_item));
end $$;

-- ---------- GIFTING ----------
create or replace function public.pvp_inv_gift(p_from text, p_to text, p_item text, p_qty integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a text := public.pvp_main(p_from); b text := public.pvp_main(p_to); mid uuid;
begin
  if not pvp_flag('gift') then return jsonb_build_object('ok', false, 'why', 'gifts closed'); end if;
  if b is null or b = a then return jsonb_build_object('ok', false, 'why', 'not to yourself'); end if;
  if not exists (select 1 from pvp_players where id = b) and not exists (select 1 from pvp_dev_profiles where id = b) and not exists (select 1 from pvp_profiles where id = b) and b <> pvp_inv_owner()
    then return jsonb_build_object('ok', false, 'why', 'no such pirate'); end if;
  if p_qty is null or p_qty < 1 or p_qty > 999 then return jsonb_build_object('ok', false, 'why', 'bad qty'); end if;
  if not pvp_rl_hit('gift:' || a, 60, 6) or not pvp_rl_hit('giftd:' || a, 86400, 100) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  if p_item like 'map:%' then
    if p_qty <> 1 then return jsonb_build_object('ok', false, 'why', 'bad qty'); end if;
    mid := pvp_inv_map(a, p_item); if mid is null then return jsonb_build_object('ok', false, 'why', 'not enough'); end if;
    update pvp_maps set player_id = b, via = 'gift' where id = mid;
    insert into pvp_inv_log (player_id, item, delta, why, ref) values (a, p_item, -1, 'gift_out', b), (b, p_item, 1, 'gift_in', a);
  else
    if pvp_inv_take(a, p_item, p_qty, 'gift_out', b) is null then return jsonb_build_object('ok', false, 'why', 'not enough'); end if;
    perform pvp_inv_add(b, p_item, p_qty, 'gift', 'gift_in', a);
  end if;
  return jsonb_build_object('ok', true, 'to', b, 'item', p_item, 'qty', p_qty,
    'left', (select coalesce(sum(qty), 0) from pvp_inv where player_id = a and item = p_item));
end $$;

-- ---------- PLAYER MARKETPLACE ----------
create or replace function public.pvp_mkt_list(p_player text, p_item text, p_qty integer, p_price integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); mid uuid; lid bigint; src text := 'market';
begin
  if not pvp_flag('market') then return jsonb_build_object('ok', false, 'why', 'market closed'); end if;
  if p_price is null or p_price < 10 or p_price > 1000000 then return jsonb_build_object('ok', false, 'why', 'bad price'); end if;
  if p_qty is null or p_qty < 1 or p_qty > 999 then return jsonb_build_object('ok', false, 'why', 'bad qty'); end if;
  if (select count(*) from pvp_mkt_listings where seller_id = pid and status = 'open') >= 20 then return jsonb_build_object('ok', false, 'why', 'too many listings'); end if;
  if not pvp_rl_hit('mlist:' || pid, 60, 6) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  insert into pvp_mkt_listings (seller_id, item, qty, price, source) values (pid, p_item, p_qty, p_price, src) returning id into lid;
  if p_item like 'map:%' then
    if p_qty <> 1 then raise exception 'bad qty'; end if;
    mid := pvp_inv_map(pid, p_item); if mid is null then delete from pvp_mkt_listings where id = lid; return jsonb_build_object('ok', false, 'why', 'not enough'); end if;
    update pvp_maps set player_id = 'escrow:' || lid, via = 'market' where id = mid;
    insert into pvp_inv_log (player_id, item, delta, why, ref) values (pid, p_item, -1, 'list', lid::text);
  elsif pvp_inv_take(pid, p_item, p_qty, 'list', lid::text) is null then delete from pvp_mkt_listings where id = lid; return jsonb_build_object('ok', false, 'why', 'not enough'); end if;
  return jsonb_build_object('ok', true, 'listing', lid);
end $$;
-- ONE transaction: lock the listing row (FOR UPDATE: a second buyer waits, then sees 'sold'), buyer pays, seller is paid (minus the
-- optional fee), the item moves, the listing closes.
create or replace function public.pvp_mkt_buy(p_player text, p_listing bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); l pvp_mkt_listings; v_fee integer := 0;
begin
  if not pvp_flag('market') then return jsonb_build_object('ok', false, 'why', 'market closed'); end if;
  if not pvp_rl_hit('mbuy:' || pid, 60, 10) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  select * into l from pvp_mkt_listings where id = p_listing for update;
  if not found or l.status <> 'open' then return jsonb_build_object('ok', false, 'why', 'gone'); end if;
  if l.seller_id = pid then return jsonb_build_object('ok', false, 'why', 'your own listing'); end if;
  if not pvp_inv_gold(pid, -l.price) then return jsonb_build_object('ok', false, 'why', 'not enough gold'); end if;
  if pvp_flag('market_fee') then v_fee := floor(l.price * 0.05); end if;
  -- the seller may be offline: the proceeds wait in their pot (pvp_inv_pot_take adds them to their gold + save on their next visit)
  if l.price - v_fee > 0 then insert into pvp_inv_owner_pot (player_id, gold) values (l.seller_id, l.price - v_fee)
    on conflict (player_id) do update set gold = pvp_inv_owner_pot.gold + excluded.gold, updated_at = now(); end if;
  if l.item like 'map:%' then update pvp_maps set player_id = pid, via = 'market' where id = substr(l.item, 5)::uuid and player_id = 'escrow:' || l.id;
    insert into pvp_inv_log (player_id, item, delta, why, ref, gold) values (pid, l.item, 1, 'buy', l.id::text, -l.price);
  else perform pvp_inv_add(pid, l.item, l.qty, 'market', 'buy', l.id::text); end if;
  update pvp_mkt_listings set status = 'sold', buyer_id = pid, fee = v_fee, closed_at = now() where id = l.id;
  return jsonb_build_object('ok', true, 'listing', l.id, 'item', l.item, 'qty', l.qty, 'price', l.price, 'fee', v_fee, 'seller', l.seller_id, 'owner', pid = pvp_inv_owner());
end $$;
create or replace function public.pvp_mkt_cancel(p_player text, p_listing bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); l pvp_mkt_listings;
begin
  select * into l from pvp_mkt_listings where id = p_listing for update;
  if not found or l.status <> 'open' or l.seller_id <> pid then return jsonb_build_object('ok', false, 'why', 'gone'); end if;
  if l.item like 'map:%' then update pvp_maps set player_id = pid, via = null where id = substr(l.item, 5)::uuid and player_id = 'escrow:' || l.id;
    insert into pvp_inv_log (player_id, item, delta, why, ref) values (pid, l.item, 1, 'unlist', l.id::text);
  else perform pvp_inv_add(pid, l.item, l.qty, l.source, 'unlist', l.id::text); end if;
  update pvp_mkt_listings set status = 'cancelled', closed_at = now() where id = l.id;
  return jsonb_build_object('ok', true, 'listing', l.id);
end $$;

-- ---------- EARNING: digs (items, no gold), fish, island finds ----------
-- every 026 dig rule, re-checked here (owner map, spot, 30 s, 20 s, 25 a day); pays NO gold. p_items = [{item, qty}] the Edge Function
-- rolled from the map id (chest.ts); p_cosmetic = a 'gear:<slot>:<id>' (pvp_owned, like 035) or null; already owned -> p_dup goes to the inventory.
create or replace function public.pvp_map_dig_inv(p_player text, p_map uuid, p_spot text, p_holder boolean, p_items jsonb, p_cosmetic text, p_crew boolean, p_dup text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); m pvp_maps; last timestamptz; today integer; e jsonb; n integer := 0; got jsonb := '[]'::jsonb; dup boolean := false;
begin
  select * into m from pvp_maps where id = p_map for update;
  if not found or m.player_id <> pid then return jsonb_build_object('ok', false, 'why', 'not your map'); end if;
  if m.dug_at is not null then return jsonb_build_object('ok', false, 'why', 'already dug'); end if;
  if m.spot <> p_spot then return jsonb_build_object('ok', false, 'why', 'wrong spot'); end if;
  if m.created_at > now() - interval '30 seconds' then return jsonb_build_object('ok', false, 'why', 'too soon'); end if;
  select max(dug_at), count(*) filter (where dug_at > now() - interval '24 hours') into last, today from pvp_maps where player_id = pid and dug_at is not null;
  if last is not null and last > now() - interval '20 seconds' then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  if today >= 25 then return jsonb_build_object('ok', false, 'why', 'daily dig limit'); end if;
  update pvp_maps set dug_at = now(), gold = 0, holder = p_holder where id = m.id;
  for e in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if (e->>'item') ~ '^(val|wpn):' and exists (select 1 from pvp_inv_prices where item = e->>'item' and shop = 'antiques') and coalesce((e->>'qty')::int, 0) between 1 and 10 then
      perform pvp_inv_add(pid, e->>'item', (e->>'qty')::int, 'chest', 'dig', m.id::text); got := got || jsonb_build_array(e); end if;
  end loop;
  if p_cosmetic is not null and p_cosmetic ~ '^gear:[a-z]{2,10}:[a-z0-9_]{2,24}$' and pid <> pvp_inv_owner() then
    insert into pvp_owned (player_id, item, source, price) values (pid, p_cosmetic, 'grant', 0) on conflict (player_id, item) do nothing;
    get diagnostics n = row_count; dup := n = 0;
    if dup and p_dup ~ '^dup:[a-z]{2,10}:[a-z0-9_]{2,24}:(common|uncommon|rare|epic|legendary)$' then perform pvp_inv_add(pid, p_dup, 1, 'chest', 'dig_dup', m.id::text); end if;
    insert into pvp_map_loot (map_id, player_id, item, crew, dup, dup_gold) values (m.id, pid, p_cosmetic, coalesce(p_crew, false), dup, 0) on conflict (map_id) do nothing;
  end if;
  return jsonb_build_object('ok', true, 'gold', 0, 'tier', m.tier, 'items', got, 'item', p_cosmetic, 'crew', coalesce(p_crew, false), 'dup', dup, 'dup_item', case when dup then p_dup end);
end $$;
-- a fish the SERVER rolled (Edge Function, fish journal weights): one bite per 6 s, 200 a day
create or replace function public.pvp_fish_catch(p_player text, p_fish text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player);
begin
  if p_fish !~ '^fish:[a-z_]{2,16}$' or not exists (select 1 from pvp_inv_prices where item = p_fish and shop = 'fish') then return jsonb_build_object('ok', false, 'why', 'bad fish'); end if;
  if not pvp_rl_hit('fish:' || pid, 6, 1) or not pvp_rl_hit('fishd:' || pid, 86400, 200) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  perform pvp_inv_add(pid, p_fish, 1, 'fish', 'catch'); return jsonb_build_object('ok', true, 'item', p_fish);
end $$;
-- an island find (idol shard / river pearl): one per spot per pirate per day
create or replace function public.pvp_inv_find(p_player text, p_item text, p_spot text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); n integer;
begin
  if p_item not in ('val:idol_shard', 'val:river_pearl') or p_spot !~ '^[a-z0-9_]{2,32}$' then return jsonb_build_object('ok', false, 'why', 'bad find'); end if;
  insert into pvp_inv_once (player_id, k) values (pid, 'find:' || p_spot || ':' || current_date) on conflict do nothing; get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'why', 'found today'); end if;
  perform pvp_inv_add(pid, p_item, 1, 'find', 'find', p_spot); return jsonb_build_object('ok', true, 'item', p_item);
end $$;
-- swords + muskets you OWN -> inventory rows (common tier), once per item. pvp_owned is NOT touched. Bought = 'carry_buy' (never resold).
create or replace function public.pvp_inv_carry(p_player text) returns integer language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); r record; n integer := 0; k integer; base text;
begin
  for r in select item, source from pvp_owned where player_id = pid and item ~ '^gear:(sword|musket):' loop
    base := split_part(r.item, ':', 3); if base not in ('cutlass', 'rapier', 'bone', 'navy', 'blunder', 'dragoon') then continue; end if;
    insert into pvp_inv_once (player_id, k) values (pid, 'carry:' || r.item) on conflict do nothing; get diagnostics k = row_count;
    if k = 1 then perform pvp_inv_add(pid, 'wpn:' || split_part(r.item, ':', 2) || ':' || base || ':common', 1, case when r.source = 'buy' then 'carry_buy' else 'carry_grant' end, 'carry'); n := n + 1; end if;
  end loop; return n;
end $$;
-- the OWNER's test kit: ~3 of every item, ONCE, owner id only. Tagged 'kit' (sellable while test_only_lock is off).
create or replace function public.pvp_inv_owner_kit(p_player text, p_items text[], p_spots text[]) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); n integer; it text; t text;
begin
  if pid <> pvp_inv_owner() then return jsonb_build_object('ok', false, 'why', 'owner only'); end if;
  insert into pvp_inv_once (player_id, k) values (pid, 'owner_kit_v1') on conflict do nothing; get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', true, 'granted', false); end if;
  foreach it in array p_items loop if it ~ '^(fish|val|wpn):' then perform pvp_inv_add(pid, it, 3, 'kit', 'owner_kit'); end if; end loop;
  foreach t in array array['common', 'rare', 'legendary'] loop for i in 1..3 loop
    insert into pvp_maps (player_id, tier, spot, source, source_ref, created_at, via) values (pid, t, case when t = 'legendary' then 'cave' else p_spots[1 + (i % array_length(p_spots, 1))] end, 'boss', 'kit:' || pid || ':' || t || ':' || i, now() - interval '1 minute', 'kit') on conflict (source_ref) do nothing;
  end loop; end loop;
  return jsonb_build_object('ok', true, 'granted', true);
end $$;
-- the owner's pot: take what has landed (his client adds it to the group save)
create or replace function public.pvp_inv_pot_take(p_player text) returns bigint language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); g bigint;
begin select gold into g from pvp_inv_owner_pot where player_id = pid for update; if coalesce(g, 0) = 0 then return 0; end if;
  update pvp_inv_owner_pot set gold = 0, updated_at = now() where player_id = pid;
  if pid <> pvp_inv_owner() then perform pvp_inv_gold(pid, g); end if;   -- the owner's gold lives on his save only
  return g; end $$;

revoke all on function public.pvp_flag(text), public.pvp_inv_owner(), public.pvp_inv_gold(text, bigint), public.pvp_inv_add(text, text, integer, text, text, text), public.pvp_inv_take(text, text, integer, text, text),
  public.pvp_inv_map(text, text), public.pvp_inv_sell(text, text, integer, text, numeric), public.pvp_inv_gift(text, text, text, integer), public.pvp_mkt_list(text, text, integer, integer),
  public.pvp_mkt_buy(text, bigint), public.pvp_mkt_cancel(text, bigint), public.pvp_map_dig_inv(text, uuid, text, boolean, jsonb, text, boolean, text), public.pvp_fish_catch(text, text),
  public.pvp_inv_find(text, text, text), public.pvp_inv_carry(text), public.pvp_inv_owner_kit(text, text[], text[]), public.pvp_inv_pot_take(text) from public, anon, authenticated;
commit;
