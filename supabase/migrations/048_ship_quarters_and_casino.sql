-- PUMPFUN PIRATES · migration 048: free ship Captain's Quarters + pure-gold casino_play.
-- ADDITIVE ONLY on top of 047 (per-gun attachments). Does NOT replace 047's
-- pvp_house_take / pvp_house_take_capped / pvp_house_store_gun bodies wholesale —
-- only injects pvp_ensure_ship_quarters calls + casino RPCs.
-- STRICTLY ZERO crypto/tokens — Harbor gold only (pvp_profiles / pvp_dev_profiles).
begin;

insert into public.pvp_flags (k, on_, note) values
  ('ship_quarters', true, 'free ship Captain''s Quarters chest (048)'),
  ('casino', true, 'pure-gold casino_play blackjack/roulette/dice/slots (048)')
  on conflict (k) do nothing;

create table if not exists public.pvp_casino_hands (
  player_id  text primary key,
  state_id   text not null,
  game       text not null default 'blackjack',
  bet        integer not null check (bet between 10 and 25000),
  player     jsonb not null default '[]'::jsonb,
  dealer     jsonb not null default '[]'::jsonb,
  deck       jsonb not null default '[]'::jsonb,
  doubled    boolean not null default false,
  status     text not null default 'open' check (status in ('open', 'done')),
  updated_at timestamptz not null default now()
);
alter table public.pvp_casino_hands enable row level security;
revoke all on public.pvp_casino_hands from public, anon, authenticated;

create or replace function public.pvp_ensure_ship_quarters(p_player text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); h pvp_houses;
begin
  if pid is null then return jsonb_build_object('ok', false, 'why', 'bad player'); end if;
  if not coalesce(pvp_flag('ship_quarters'), false) and not coalesce(pvp_flag('houses'), false) then
    return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  select * into h from pvp_houses where player_id = pid and cottage_id = 'ship_quarters';
  if found then
    return jsonb_build_object('ok', true, 'cottage', 'ship_quarters', 'tier', h.tier, 'slots', h.slots, 'already', true);
  end if;
  insert into pvp_houses (player_id, cottage_id, tier, slots)
    values (pid, 'ship_quarters', 'captain', 12)
    on conflict (player_id, cottage_id) do nothing;
  return jsonb_build_object('ok', true, 'cottage', 'ship_quarters', 'tier', 'captain', 'slots', 12);
end $$;
revoke all on function public.pvp_ensure_ship_quarters(text) from public, anon, authenticated;

-- Thin ensure wrappers: keep 047 gun-from-house / meta.acc behavior intact.
create or replace function public.pvp_house_store(p_player text, p_cottage text, p_item text, p_qty integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pid text := public.pvp_main(p_player); h pvp_houses;
  used integer; dest integer; stack_slot integer; leftq integer;
  q integer := greatest(1, least(coalesce(p_qty, 1), 999));
  is_wpn boolean := coalesce(p_item, '') like 'wpn:%';
  placed integer := 0; first_slot integer; one integer;
begin
  if not pvp_flag('houses') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  if p_cottage is null or p_item is null or p_item !~ '^(fish|val|wpn|dup):' then
    return jsonb_build_object('ok', false, 'why', 'bad item'); end if;
  if p_cottage = 'ship_quarters' then perform public.pvp_ensure_ship_quarters(pid); end if;
  select * into h from pvp_houses where player_id = pid and cottage_id = p_cottage for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'not owned'); end if;
  if exists (select 1 from pvp_inv_equip where player_id = pid and item = p_item) then
    return jsonb_build_object('ok', false, 'why', 'equipped'); end if;
  if not pvp_rl_hit('hstore:' || pid, 60, 40) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;

  if is_wpn then
    select count(*) into used from pvp_house_storage where player_id = pid and cottage_id = p_cottage;
    if used >= h.slots then return jsonb_build_object('ok', false, 'why', 'chest full'); end if;
    q := least(q, h.slots - used);
    leftq := pvp_inv_take(pid, p_item, q, 'house_store', p_cottage);
    if leftq is null then return jsonb_build_object('ok', false, 'why', 'not enough'); end if;
    for one in 1..q loop
      select min(g) into dest from generate_series(0, h.slots - 1) g
        where not exists (select 1 from pvp_house_storage s
          where s.player_id = pid and s.cottage_id = p_cottage and s.slot = g);
      if dest is null then
        if one <= q then
          perform pvp_inv_add(pid, p_item, q - one + 1, 'house', 'house_store_rollback', p_cottage);
        end if;
        exit;
      end if;
      insert into pvp_house_storage (player_id, cottage_id, slot, item, qty, meta)
        values (pid, p_cottage, dest, p_item, 1, '{}'::jsonb);
      if first_slot is null then first_slot := dest; end if;
      placed := placed + 1;
    end loop;
    if placed = 0 then return jsonb_build_object('ok', false, 'why', 'chest full'); end if;
    return jsonb_build_object('ok', true, 'item', p_item, 'qty', placed, 'slot', first_slot,
      'left', leftq, 'used', (select count(*) from pvp_house_storage where player_id = pid and cottage_id = p_cottage),
      'slots', h.slots);
  end if;

  select count(*) into used from pvp_house_storage where player_id = pid and cottage_id = p_cottage;
  select slot into stack_slot from pvp_house_storage
    where player_id = pid and cottage_id = p_cottage and item = p_item
    order by slot limit 1 for update;
  if stack_slot is null and used >= h.slots then return jsonb_build_object('ok', false, 'why', 'chest full'); end if;
  leftq := pvp_inv_take(pid, p_item, q, 'house_store', p_cottage);
  if leftq is null then return jsonb_build_object('ok', false, 'why', 'not enough'); end if;
  if stack_slot is not null then
    update pvp_house_storage set qty = qty + q, updated_at = now()
      where player_id = pid and cottage_id = p_cottage and slot = stack_slot;
    dest := stack_slot;
  else
    select min(g) into dest from generate_series(0, h.slots - 1) g
      where not exists (select 1 from pvp_house_storage s
        where s.player_id = pid and s.cottage_id = p_cottage and s.slot = g);
    if dest is null then
      perform pvp_inv_add(pid, p_item, q, 'house', 'house_store_rollback', p_cottage);
      return jsonb_build_object('ok', false, 'why', 'chest full');
    end if;
    insert into pvp_house_storage (player_id, cottage_id, slot, item, qty, meta)
      values (pid, p_cottage, dest, p_item, q, '{}'::jsonb);
  end if;
  return jsonb_build_object('ok', true, 'item', p_item, 'qty', q, 'slot', dest,
    'left', leftq, 'used', (select count(*) from pvp_house_storage where player_id = pid and cottage_id = p_cottage),
    'slots', h.slots);
end $$;
revoke all on function public.pvp_house_store(text, text, text, integer) from public, anon, authenticated;

-- 047 take + gun_from_house, plus ship_quarters ensure
create or replace function public.pvp_house_take(p_player text, p_cottage text, p_slot integer, p_qty integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pid text := public.pvp_main(p_player); r pvp_house_storage; q integer; src text;
begin
  if not pvp_flag('houses') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  if p_cottage = 'ship_quarters' then perform public.pvp_ensure_ship_quarters(pid); end if;
  select * into r from pvp_house_storage where player_id = pid and cottage_id = p_cottage and slot = p_slot for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'empty'); end if;
  q := case when r.item like 'wpn:%' then 1 else greatest(1, least(coalesce(p_qty, 1), r.qty)) end;
  if q > r.qty then return jsonb_build_object('ok', false, 'why', 'not enough'); end if;
  src := public.pvp_house_inv_source(r.meta);
  perform pvp_inv_add(pid, r.item, q, src, 'house_take', p_cottage);
  perform pvp_gun_from_house(pid, p_cottage, p_slot, r.item, r.meta);
  if q >= r.qty then delete from pvp_house_storage where player_id = pid and cottage_id = p_cottage and slot = p_slot;
  else update pvp_house_storage set qty = qty - q where player_id = pid and cottage_id = p_cottage and slot = p_slot; end if;
  return jsonb_build_object('ok', true, 'item', r.item, 'qty', q, 'slot', p_slot, 'meta', coalesce(r.meta, '{}'::jsonb));
end $$;
revoke all on function public.pvp_house_take(text, text, integer, integer) from public, anon, authenticated;

create or replace function public.pvp_house_take_capped(
  p_player text, p_cottage text, p_slot integer, p_qty integer, p_cap integer, p_owner boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pid text := public.pvp_main(p_player); r pvp_house_storage; q integer; src text;
  used integer; room integer;
begin
  if not pvp_flag('houses') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  if p_cottage = 'ship_quarters' then perform public.pvp_ensure_ship_quarters(pid); end if;
  select * into r from pvp_house_storage where player_id = pid and cottage_id = p_cottage and slot = p_slot for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'empty'); end if;
  q := case when r.item like 'wpn:%' then 1 else greatest(1, least(coalesce(p_qty, 1), r.qty)) end;
  if not p_owner and p_cap is not null and p_cap > 0 then
    select coalesce(sum(case when item like 'wpn:%' then qty else 1 end), 0) into used from pvp_inv where player_id = pid;
    room := greatest(0, p_cap - used);
    if room <= 0 then return jsonb_build_object('ok', false, 'why', 'backpack full'); end if;
    if r.item not like 'wpn:%' then q := least(q, room); end if;
  end if;
  src := public.pvp_house_inv_source(r.meta);
  perform pvp_inv_add(pid, r.item, q, src, 'house_take', p_cottage);
  perform pvp_gun_from_house(pid, p_cottage, p_slot, r.item, r.meta);
  if q >= r.qty then delete from pvp_house_storage where player_id = pid and cottage_id = p_cottage and slot = p_slot;
  else update pvp_house_storage set qty = qty - q where player_id = pid and cottage_id = p_cottage and slot = p_slot; end if;
  return jsonb_build_object('ok', true, 'item', r.item, 'qty', q, 'meta', coalesce(r.meta, '{}'::jsonb));
end $$;
revoke all on function public.pvp_house_take_capped(text, text, integer, integer, integer, boolean) from public, anon, authenticated;

-- Ensure ship_quarters before gun store too
create or replace function public.pvp_house_store_gun(p_player text, p_cottage text, p_gid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pid text := public.pvp_main(p_player); h pvp_houses; g pvp_gun_inst; dest int; used int;
  meta jsonb;
begin
  if not pvp_flag('houses') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  if p_cottage = 'ship_quarters' then perform public.pvp_ensure_ship_quarters(pid); end if;
  select * into g from pvp_gun_inst where gid = p_gid and player_id = pid for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'no gun'); end if;
  if g.place = 'equip' then return jsonb_build_object('ok', false, 'why', 'equipped'); end if;
  if g.place = 'house' then return jsonb_build_object('ok', false, 'why', 'already stored'); end if;
  select * into h from pvp_houses where player_id = pid and cottage_id = p_cottage for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'not owned'); end if;
  select count(*) into used from pvp_house_storage where player_id = pid and cottage_id = p_cottage;
  if used >= h.slots then return jsonb_build_object('ok', false, 'why', 'chest full'); end if;
  if pvp_inv_take(pid, g.item, 1, 'house_store', p_cottage) is null then
    return jsonb_build_object('ok', false, 'why', 'not enough'); end if;
  select min(gs) into dest from generate_series(0, h.slots - 1) gs
    where not exists (select 1 from pvp_house_storage s
      where s.player_id = pid and s.cottage_id = p_cottage and s.slot = gs);
  if dest is null then
    perform pvp_inv_add(pid, g.item, 1, 'house', 'house_store_rollback', p_cottage);
    return jsonb_build_object('ok', false, 'why', 'chest full');
  end if;
  meta := jsonb_build_object('gid', g.gid, 'acc', coalesce(g.acc, '{}'::jsonb), 'source', 'house');
  insert into pvp_house_storage (player_id, cottage_id, slot, item, qty, meta)
    values (pid, p_cottage, dest, g.item, 1, meta);
  update pvp_gun_inst set place = 'house', cottage_id = p_cottage, house_slot = dest, updated_at = now()
    where gid = g.gid;
  return jsonb_build_object('ok', true, 'item', g.item, 'qty', 1, 'slot', dest, 'meta', meta, 'gid', g.gid,
    'used', used + 1, 'slots', h.slots);
end $$;
revoke all on function public.pvp_house_store_gun(text, text, uuid) from public, anon, authenticated;

create or replace function public.pvp_casino_debit(p_player text, p_bet integer, p_req text, p_game text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); g integer; rv integer; prev pvp_purchases; is_wallet boolean := pid like 'wallet:%';
  bet integer := least(greatest(coalesce(p_bet, 0), 0), 25000);
begin
  if not pvp_flag('casino') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  if bet < 10 then return jsonb_build_object('ok', false, 'why', 'min bet'); end if;
  if p_req is null or p_game is null or p_game not in ('blackjack','roulette','dice','slots') then
    return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
  select * into prev from pvp_purchases where req = p_req;
  if found then
    if prev.player_id <> pid then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
    return jsonb_build_object('ok', true, 'gold', prev.gold_after, 'debited', prev.price, 'retry', true);
  end if;
  if not pvp_rl_hit('casino:' || pid, 60, 40) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  if pid = 'dev:e191a32e15abea4f14355121' then
    return jsonb_build_object('ok', true, 'owner', true, 'gold', 999999, 'debited', bet);
  end if;
  if is_wallet then select gold, shop_rev into g, rv from pvp_profiles where id = pid for update;
  else select gold, shop_rev into g, rv from pvp_dev_profiles where id = pid for update; end if;
  if not found then return jsonb_build_object('ok', false, 'why', 'no save yet'); end if;
  if g < bet then return jsonb_build_object('ok', false, 'why', 'not enough gold', 'gold', g); end if;
  rv := rv + 1;
  if is_wallet then update pvp_profiles set gold = g - bet, shop_rev = rv where id = pid;
  else update pvp_dev_profiles set gold = g - bet, shop_rev = rv where id = pid; end if;
  insert into pvp_purchases (player_id, req, item, price, gold_before, gold_after, rev)
    values (pid, p_req, 'casino:' || p_game, bet, g, g - bet, rv);
  return jsonb_build_object('ok', true, 'gold', g - bet, 'debited', bet, 'rev', rv);
end $$;
revoke all on function public.pvp_casino_debit(text, integer, text, text) from public, anon, authenticated;

create or replace function public.pvp_casino_credit(p_player text, p_payout integer, p_game text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); g integer; is_wallet boolean := pid like 'wallet:%';
  pay integer := greatest(coalesce(p_payout, 0), 0);
begin
  if not pvp_flag('casino') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  if pay <= 0 then
    if is_wallet then select gold into g from pvp_profiles where id = pid;
    else select gold into g from pvp_dev_profiles where id = pid; end if;
    return jsonb_build_object('ok', true, 'gold', coalesce(g, 0), 'credited', 0);
  end if;
  if pid = 'dev:e191a32e15abea4f14355121' then
    return jsonb_build_object('ok', true, 'owner', true, 'gold', 999999, 'credited', pay);
  end if;
  if is_wallet then update pvp_profiles set gold = gold + pay where id = pid returning gold into g;
  else update pvp_dev_profiles set gold = gold + pay where id = pid returning gold into g; end if;
  if not found then return jsonb_build_object('ok', false, 'why', 'no save yet'); end if;
  return jsonb_build_object('ok', true, 'gold', g, 'credited', pay, 'game', p_game, 'note', p_note);
end $$;
revoke all on function public.pvp_casino_credit(text, integer, text, text) from public, anon, authenticated;

commit;
