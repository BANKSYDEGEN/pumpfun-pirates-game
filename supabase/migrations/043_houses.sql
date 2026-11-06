-- PUMPFUN PIRATES · migration 043 (storage-houses): buyable cottages + persistent house chest storage.
-- ADDITIVE ONLY. Client kill switch: &houses=0. Edge: supabase/functions/pvp/houses.ts (house_state/buy/store/take/upgrade).
-- Gold spend mirrors pvp_shop_buy / pvp_wish_toss (pvp_purchases + shop_rev). Item moves reuse pvp_inv_take / pvp_inv_add (036).
begin;

insert into public.pvp_flags (k, on_, note) values
  ('houses', true, 'buyable cottages + house chest storage (043)')
  on conflict (k) do nothing;

create table if not exists public.pvp_houses (
  player_id    text not null,
  cottage_id   text not null check (cottage_id ~ '^[a-z0-9_]{2,24}$'),
  tier         text not null default 'cozy' check (tier in ('cozy', 'captain', 'manor')),
  slots        integer not null default 24 check (slots between 8 and 120),
  purchased_at timestamptz not null default now(),
  primary key (player_id, cottage_id)
);
create index if not exists pvp_houses_player_idx on public.pvp_houses (player_id);
alter table public.pvp_houses enable row level security;
revoke all on public.pvp_houses from public, anon, authenticated;

-- One row per stacked item (or unique weapon copy) in a player's cottage chest.
create table if not exists public.pvp_house_storage (
  player_id  text not null,
  cottage_id text not null,
  slot       integer not null check (slot between 0 and 119),
  item       text not null check (char_length(item) between 3 and 64),
  qty        integer not null check (qty between 1 and 9999),
  meta       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (player_id, cottage_id, slot),
  foreign key (player_id, cottage_id) references public.pvp_houses (player_id, cottage_id) on delete cascade
);
create index if not exists pvp_house_storage_item_idx on public.pvp_house_storage (player_id, cottage_id, item);
alter table public.pvp_house_storage enable row level security;
revoke all on public.pvp_house_storage from public, anon, authenticated;

-- Buy a cottage (idempotent via pvp_purchases req). Owner free. Price checked by Edge Function.
create or replace function public.pvp_house_buy(p_player text, p_cottage text, p_tier text, p_slots integer, p_price integer, p_req text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); g integer; rv integer; prev pvp_purchases; is_wallet boolean := pid like 'wallet:%';
  slots integer := least(greatest(coalesce(p_slots, 24), 8), 120);
  tier text := case when p_tier in ('cozy','captain','manor') then p_tier else 'cozy' end;
begin
  if p_cottage is null or p_cottage !~ '^[a-z0-9_]{2,24}$' or p_req is null or p_price is null or p_price < 0 then
    return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
  if not pvp_flag('houses') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  select * into prev from pvp_purchases where req = p_req;
  if found then
    if prev.player_id <> pid then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
    return jsonb_build_object('ok', true, 'gold', prev.gold_after, 'rev', prev.rev, 'retry', true,
      'cottage', p_cottage, 'tier', tier, 'slots', slots);
  end if;
  if exists (select 1 from pvp_houses where player_id = pid and cottage_id = p_cottage) then
    return jsonb_build_object('ok', true, 'already', true, 'cottage', p_cottage);
  end if;
  if not pvp_rl_hit('hbuy:' || pid, 60, 4) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  if pid = 'dev:e191a32e15abea4f14355121' then
    insert into pvp_houses (player_id, cottage_id, tier, slots) values (pid, p_cottage, tier, slots)
      on conflict do nothing;
    return jsonb_build_object('ok', true, 'owner', true, 'cottage', p_cottage, 'tier', tier, 'slots', slots);
  end if;
  if is_wallet then select gold, shop_rev into g, rv from pvp_profiles where id = pid for update;
  else select gold, shop_rev into g, rv from pvp_dev_profiles where id = pid for update; end if;
  if not found then return jsonb_build_object('ok', false, 'why', 'no save yet'); end if;
  if g < p_price then return jsonb_build_object('ok', false, 'why', 'not enough gold', 'gold', g); end if;
  rv := rv + 1;
  if is_wallet then update pvp_profiles set gold = g - p_price, shop_rev = rv where id = pid;
  else update pvp_dev_profiles set gold = g - p_price, shop_rev = rv where id = pid; end if;
  insert into pvp_purchases (player_id, req, item, price, gold_before, gold_after, rev)
    values (pid, p_req, 'house:' || p_cottage, p_price, g, g - p_price, rv);
  insert into pvp_houses (player_id, cottage_id, tier, slots) values (pid, p_cottage, tier, slots)
    on conflict do nothing;
  return jsonb_build_object('ok', true, 'gold', g - p_price, 'rev', rv, 'cottage', p_cottage, 'tier', tier, 'slots', slots);
end $$;
revoke all on function public.pvp_house_buy(text, text, text, integer, integer, text) from public, anon, authenticated;

-- Deposit backpack item into house chest (atomic: take from inv THEN place in chest). Blocks equipped weapons.
create or replace function public.pvp_house_store(p_player text, p_cottage text, p_item text, p_qty integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); h pvp_houses; used integer; dest integer; q integer := greatest(1, least(coalesce(p_qty, 1), 999));
  leftq integer; stack_slot integer;
begin
  if not pvp_flag('houses') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  if p_cottage is null or p_item is null or p_item !~ '^(fish|val|wpn|dup):' then return jsonb_build_object('ok', false, 'why', 'bad item'); end if;
  select * into h from pvp_houses where player_id = pid and cottage_id = p_cottage for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'not owned'); end if;
  if exists (select 1 from pvp_inv_equip where player_id = pid and item = p_item) then
    return jsonb_build_object('ok', false, 'why', 'equipped'); end if;
  if not pvp_rl_hit('hstore:' || pid, 60, 40) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  select count(*) into used from pvp_house_storage where player_id = pid and cottage_id = p_cottage;
  -- Prefer stacking onto an existing non-weapon row
  if p_item not like 'wpn:%' then
    select slot into stack_slot from pvp_house_storage where player_id = pid and cottage_id = p_cottage and item = p_item
      order by slot limit 1 for update;
  end if;
  if stack_slot is null and used >= h.slots then return jsonb_build_object('ok', false, 'why', 'chest full'); end if;
  leftq := pvp_inv_take(pid, p_item, q, 'house_store', p_cottage);
  if leftq is null then return jsonb_build_object('ok', false, 'why', 'not enough'); end if;
  if stack_slot is not null then
    update pvp_house_storage set qty = qty + q, updated_at = now() where player_id = pid and cottage_id = p_cottage and slot = stack_slot;
    dest := stack_slot;
  else
    select min(g) into dest from generate_series(0, h.slots - 1) g
      where not exists (select 1 from pvp_house_storage s where s.player_id = pid and s.cottage_id = p_cottage and s.slot = g);
    if dest is null then
      perform pvp_inv_add(pid, p_item, q, 'house', 'house_store_rollback', p_cottage);
      return jsonb_build_object('ok', false, 'why', 'chest full');
    end if;
    insert into pvp_house_storage (player_id, cottage_id, slot, item, qty) values (pid, p_cottage, dest, p_item, q);
  end if;
  return jsonb_build_object('ok', true, 'item', p_item, 'qty', q, 'slot', dest,
    'left', leftq, 'used', (select count(*) from pvp_house_storage where player_id = pid and cottage_id = p_cottage), 'slots', h.slots);
end $$;
revoke all on function public.pvp_house_store(text, text, text, integer) from public, anon, authenticated;

-- Withdraw from house chest back to backpack.
create or replace function public.pvp_house_take(p_player text, p_cottage text, p_slot integer, p_qty integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); h pvp_houses; r pvp_house_storage; q integer := greatest(1, least(coalesce(p_qty, 1), 999));
begin
  if not pvp_flag('houses') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  select * into h from pvp_houses where player_id = pid and cottage_id = p_cottage for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'not owned'); end if;
  select * into r from pvp_house_storage where player_id = pid and cottage_id = p_cottage and slot = p_slot for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'empty slot'); end if;
  if not pvp_rl_hit('htake:' || pid, 60, 40) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  q := least(q, r.qty);
  if r.qty = q then delete from pvp_house_storage where player_id = pid and cottage_id = p_cottage and slot = p_slot;
  else update pvp_house_storage set qty = qty - q, updated_at = now() where player_id = pid and cottage_id = p_cottage and slot = p_slot; end if;
  perform pvp_inv_add(pid, r.item, q, 'house', 'house_take', p_cottage);
  return jsonb_build_object('ok', true, 'item', r.item, 'qty', q, 'slot', p_slot,
    'used', (select count(*) from pvp_house_storage where player_id = pid and cottage_id = p_cottage), 'slots', h.slots);
end $$;
revoke all on function public.pvp_house_take(text, text, integer, integer) from public, anon, authenticated;

-- Upgrade chest capacity (+16 slots, gold). Caps at 120.
create or replace function public.pvp_house_upgrade(p_player text, p_cottage text, p_add integer, p_price integer, p_req text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); h pvp_houses; g integer; rv integer; prev pvp_purchases; is_wallet boolean := pid like 'wallet:%';
  addn integer := least(greatest(coalesce(p_add, 16), 1), 32); nxt integer;
begin
  if not pvp_flag('houses') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  if p_req is null or p_price is null or p_price < 0 then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
  select * into prev from pvp_purchases where req = p_req;
  if found then
    if prev.player_id <> pid then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
    select * into h from pvp_houses where player_id = pid and cottage_id = p_cottage;
    return jsonb_build_object('ok', true, 'gold', prev.gold_after, 'rev', prev.rev, 'retry', true, 'slots', coalesce(h.slots, 24));
  end if;
  select * into h from pvp_houses where player_id = pid and cottage_id = p_cottage for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'not owned'); end if;
  nxt := least(120, h.slots + addn);
  if nxt <= h.slots then return jsonb_build_object('ok', false, 'why', 'max slots'); end if;
  if not pvp_rl_hit('hupg:' || pid, 60, 4) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  if pid = 'dev:e191a32e15abea4f14355121' then
    update pvp_houses set slots = nxt, tier = case when nxt >= 60 then 'manor' when nxt >= 40 then 'captain' else tier end where player_id = pid and cottage_id = p_cottage;
    return jsonb_build_object('ok', true, 'owner', true, 'slots', nxt);
  end if;
  if is_wallet then select gold, shop_rev into g, rv from pvp_profiles where id = pid for update;
  else select gold, shop_rev into g, rv from pvp_dev_profiles where id = pid for update; end if;
  if not found then return jsonb_build_object('ok', false, 'why', 'no save yet'); end if;
  if g < p_price then return jsonb_build_object('ok', false, 'why', 'not enough gold', 'gold', g); end if;
  rv := rv + 1;
  if is_wallet then update pvp_profiles set gold = g - p_price, shop_rev = rv where id = pid;
  else update pvp_dev_profiles set gold = g - p_price, shop_rev = rv where id = pid; end if;
  insert into pvp_purchases (player_id, req, item, price, gold_before, gold_after, rev)
    values (pid, p_req, 'house_up:' || p_cottage || ':' || nxt, p_price, g, g - p_price, rv);
  update pvp_houses set slots = nxt, tier = case when nxt >= 60 then 'manor' when nxt >= 40 then 'captain' else tier end
    where player_id = pid and cottage_id = p_cottage;
  return jsonb_build_object('ok', true, 'gold', g - p_price, 'rev', rv, 'slots', nxt);
end $$;
revoke all on function public.pvp_house_upgrade(text, text, integer, integer, text) from public, anon, authenticated;

commit;
