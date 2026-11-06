-- pfp-v329 / BANKSY t1742u + t1743u
-- Root cause: pvp_house_take / pvp_house_take_capped / pvp_house_store_rollback call
--   pvp_inv_add(..., 'house', ...) but pvp_inv.source CHECK never allowed 'house'
--   → Postgres 23514 → Edge Function catch → HTTP 500 { error: "house error" }.
-- Also: weapons (wpn:*) must NEVER stack in cottage chests (attachments / per-unit identity).
-- Additive only. Safe to re-run.
begin;

-- 1) Allow provenance source 'house' (items withdrawn from / rolled back into cottage storage).
--    Tradeable: pvp_inv_take already refuses carry_buy / locked kit, so anything that entered a
--    chest was tradeable; 'house' stays tradeable the same way as 'chest' / 'fish' / 'find'.
alter table public.pvp_inv drop constraint if exists pvp_inv_source_check;
alter table public.pvp_inv add constraint pvp_inv_source_check
  check (source = any (array[
    'fish'::text, 'chest'::text, 'find'::text, 'gift'::text, 'market'::text,
    'kit'::text, 'carry_buy'::text, 'carry_grant'::text, 'house'::text
  ]));

-- 2) Helper: restore a safe inv source from chest meta (legacy rows have meta='{}' → 'house').
create or replace function public.pvp_house_inv_source(p_meta jsonb)
returns text language sql immutable as $$
  select case
    when coalesce(p_meta->>'source','') = any (array[
      'fish','chest','find','gift','market','kit','carry_buy','carry_grant','house'
    ]) then p_meta->>'source'
    else 'house'
  end;
$$;
revoke all on function public.pvp_house_inv_source(jsonb) from public, anon, authenticated;

-- 3) pvp_house_store: weapons always qty=1 per chest slot; preserve meta; never merge wpn:*.
create or replace function public.pvp_house_store(p_player text, p_cottage text, p_item text, p_qty integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pid text := public.pvp_main(p_player); h pvp_houses;
  used integer; dest integer; q integer := greatest(1, least(coalesce(p_qty, 1), 999));
  leftq integer; stack_slot integer; placed integer := 0; one integer; first_slot integer;
  is_wpn boolean := p_item like 'wpn:%';
begin
  if not pvp_flag('houses') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  if p_cottage is null or p_item is null or p_item !~ '^(fish|val|wpn|dup):' then
    return jsonb_build_object('ok', false, 'why', 'bad item'); end if;
  select * into h from pvp_houses where player_id = pid and cottage_id = p_cottage for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'not owned'); end if;
  if exists (select 1 from pvp_inv_equip where player_id = pid and item = p_item) then
    return jsonb_build_object('ok', false, 'why', 'equipped'); end if;
  if not pvp_rl_hit('hstore:' || pid, 60, 40) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;

  -- Weapons: one unit per chest slot (never stack). Deposit up to free slots.
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
        -- rollback remaining undeposited units
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

  -- Stackables (fish / val / dup): merge onto existing row when possible.
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

-- 4) pvp_house_take: restore via allowed source (meta or 'house'); weapons always qty=1 out.
create or replace function public.pvp_house_take(p_player text, p_cottage text, p_slot integer, p_qty integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pid text := public.pvp_main(p_player); h pvp_houses; r pvp_house_storage;
  q integer := greatest(1, least(coalesce(p_qty, 1), 999));
  src text;
begin
  if not pvp_flag('houses') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  select * into h from pvp_houses where player_id = pid and cottage_id = p_cottage for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'not owned'); end if;
  select * into r from pvp_house_storage where player_id = pid and cottage_id = p_cottage and slot = p_slot for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'empty slot'); end if;
  if not pvp_rl_hit('htake:' || pid, 60, 40) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  -- Weapons never leave as a multi-qty stack from one slot (legacy qty>1 rows: take 1 per call).
  if r.item like 'wpn:%' then q := 1; else q := least(q, r.qty); end if;
  q := least(q, r.qty);
  if r.qty = q then delete from pvp_house_storage where player_id = pid and cottage_id = p_cottage and slot = p_slot;
  else update pvp_house_storage set qty = qty - q, updated_at = now()
    where player_id = pid and cottage_id = p_cottage and slot = p_slot; end if;
  src := public.pvp_house_inv_source(r.meta);
  perform pvp_inv_add(pid, r.item, q, src, 'house_take', p_cottage);
  return jsonb_build_object('ok', true, 'item', r.item, 'qty', q, 'slot', p_slot, 'meta', coalesce(r.meta, '{}'::jsonb),
    'used', (select count(*) from pvp_house_storage where player_id = pid and cottage_id = p_cottage), 'slots', h.slots);
end $$;
revoke all on function public.pvp_house_take(text, text, integer, integer) from public, anon, authenticated;

-- 5) pvp_house_take_capped: same source restore + weapon qty=1.
create or replace function public.pvp_house_take_capped(
  p_player text, p_cottage text, p_slot integer, p_qty integer, p_cap integer, p_owner boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pid text := public.pvp_main(p_player);
  h pvp_houses; r pvp_house_storage;
  q integer := greatest(1, least(coalesce(p_qty, 1), 999));
  used integer := 0; need_new boolean := true;
  cap integer := coalesce(p_cap, 16);
  src text;
begin
  if not pvp_flag('houses') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  if p_cottage is null or p_slot is null then return jsonb_build_object('ok', false, 'why', 'bad take'); end if;
  select * into h from pvp_houses where player_id = pid and cottage_id = p_cottage for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'not owned'); end if;
  select * into r from pvp_house_storage where player_id = pid and cottage_id = p_cottage and slot = p_slot for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'empty'); end if;
  if r.item like 'wpn:%' then q := 1; else q := least(q, r.qty); end if;
  q := least(q, r.qty);

  if not coalesce(p_owner, false) and pvp_flag('bagcap') and cap > 0 then
    select coalesce(sum(case when item like 'wpn:%' then qty else 1 end), 0)::int into used
      from (
        select item, sum(qty) as qty from pvp_inv where player_id = pid group by item
      ) t
      where item not in (select item from pvp_inv_equip where player_id = pid and slot in ('sword','musket'));
    need_new := not exists (
      select 1 from pvp_inv where player_id = pid and item = r.item
    ) or r.item like 'wpn:%';
    if need_new and used >= cap then
      return jsonb_build_object('ok', false, 'why', 'Backpack full (16/16) — stash or sell items first!', 'full', true, 'used', used, 'cap', cap);
    end if;
  end if;

  if r.qty = q then delete from pvp_house_storage where player_id = pid and cottage_id = p_cottage and slot = p_slot;
  else update pvp_house_storage set qty = r.qty - q, updated_at = now()
    where player_id = pid and cottage_id = p_cottage and slot = p_slot; end if;
  src := public.pvp_house_inv_source(r.meta);
  perform pvp_inv_add(pid, r.item, q, src, 'house_take', p_cottage);
  return jsonb_build_object('ok', true, 'item', r.item, 'qty', q, 'meta', coalesce(r.meta, '{}'::jsonb));
end $$;
revoke all on function public.pvp_house_take_capped(text, text, integer, integer, integer, boolean) from public, anon, authenticated;

-- 6) Unroll legacy stacked weapons in cottage chests into qty=1 slots (attachments / per-unit identity).
do $$
declare
  r record; need integer; free integer; dest integer; i integer; cap integer;
begin
  for r in
    select * from pvp_house_storage where item like 'wpn:%' and qty > 1
    order by player_id, cottage_id, slot
    for update
  loop
    select slots into cap from pvp_houses where player_id = r.player_id and cottage_id = r.cottage_id;
    if cap is null then continue; end if;
    need := r.qty - 1;
    select count(*) into free from pvp_house_storage where player_id = r.player_id and cottage_id = r.cottage_id;
    free := greatest(0, cap - free);
    -- Keep one in the original slot; split as many as free slots allow.
    for i in 1..least(need, free) loop
      select min(g) into dest from generate_series(0, cap - 1) g
        where not exists (
          select 1 from pvp_house_storage s
          where s.player_id = r.player_id and s.cottage_id = r.cottage_id and s.slot = g
        );
      exit when dest is null;
      insert into pvp_house_storage (player_id, cottage_id, slot, item, qty, meta)
        values (r.player_id, r.cottage_id, dest, r.item, 1, coalesce(r.meta, '{}'::jsonb));
      need := need - 1;
    end loop;
    update pvp_house_storage set qty = 1 + need, updated_at = now()
      where player_id = r.player_id and cottage_id = r.cottage_id and slot = r.slot;
    -- If still >1 (chest had no free slots), leave remainder; take path forces qty=1 per withdraw.
    if need = 0 then
      update pvp_house_storage set qty = 1, updated_at = now()
        where player_id = r.player_id and cottage_id = r.cottage_id and slot = r.slot;
    end if;
  end loop;
end $$;

commit;
