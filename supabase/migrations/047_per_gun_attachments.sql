-- pfp-v332 / BANKSY t1746u: bind musket attachments to individual musket copies
-- across Equipped, Backpack, and Cottage Storage. Additive only. Safe to re-run.
begin;

create table if not exists public.pvp_gun_inst (
  gid         uuid primary key default gen_random_uuid(),
  player_id   text not null,
  item        text not null,
  place       text not null check (place = any (array['equip'::text, 'bag'::text, 'house'::text])),
  cottage_id  text,
  house_slot  integer,
  acc         jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint pvp_gun_inst_item_chk check (item ~ '^wpn:musket:[a-z_]{2,16}:(common|rare|epic|legendary)$'),
  constraint pvp_gun_inst_acc_chk check (jsonb_typeof(acc) = 'object')
);
create index if not exists pvp_gun_inst_player_idx on public.pvp_gun_inst (player_id);
create unique index if not exists pvp_gun_inst_equip_uidx on public.pvp_gun_inst (player_id) where place = 'equip';
create unique index if not exists pvp_gun_inst_house_uidx on public.pvp_gun_inst (player_id, cottage_id, house_slot)
  where place = 'house' and cottage_id is not null and house_slot is not null;
alter table public.pvp_gun_inst enable row level security;
revoke all on table public.pvp_gun_inst from public, anon, authenticated;

-- Valid attachment keys (must match invCatalog / musketUpgrades GUN_ACC).
create or replace function public.pvp_gun_acc_ok(p_acc jsonb)
returns boolean language sql immutable as $$
  select coalesce((
    select bool_and(
      k in ('scope','bayonet','stock','horn')
      and v in ('val:acc_scope','val:acc_bayonet','val:acc_stock','val:acc_horn')
      and (
        (k = 'scope' and v = 'val:acc_scope') or
        (k = 'bayonet' and v = 'val:acc_bayonet') or
        (k = 'stock' and v = 'val:acc_stock') or
        (k = 'horn' and v = 'val:acc_horn')
      )
    )
    from jsonb_each_text(coalesce(p_acc, '{}'::jsonb)) as e(k, v)
  ), true);
$$;
revoke all on function public.pvp_gun_acc_ok(jsonb) from public, anon, authenticated;

-- Mint missing bag/equip instances so #gun_inst matches musket copies in inv (+ equipped).
create or replace function public.pvp_gun_ensure(p_player text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pid text := public.pvp_main(p_player);
  r record; need int; have int; eq_item text; i int;
begin
  select item into eq_item from pvp_inv_equip where player_id = pid and slot = 'musket';
  -- Ensure the equipped musket has exactly one place='equip' row (create or move).
  if eq_item is not null and eq_item ~ '^wpn:musket:' then
    if not exists (select 1 from pvp_gun_inst where player_id = pid and place = 'equip' and item = eq_item) then
      -- Prefer promoting a bag copy of the same item; else insert fresh.
      update pvp_gun_inst set place = 'equip', cottage_id = null, house_slot = null, updated_at = now()
        where gid = (
          select gid from pvp_gun_inst where player_id = pid and place = 'bag' and item = eq_item
          order by updated_at limit 1
        );
      if not found then
        -- clear stale equip row of a different item first
        update pvp_gun_inst set place = 'bag', updated_at = now() where player_id = pid and place = 'equip';
        insert into pvp_gun_inst (player_id, item, place, acc)
          values (pid, eq_item, 'equip', '{}'::jsonb);
      else
        update pvp_gun_inst set place = 'bag', updated_at = now()
          where player_id = pid and place = 'equip' and item is distinct from eq_item;
      end if;
    end if;
  else
    update pvp_gun_inst set place = 'bag', updated_at = now() where player_id = pid and place = 'equip';
  end if;

  -- For each musket stack in inv, ensure bag(+equip) instance count == qty.
  for r in
    select item, coalesce(sum(qty), 0)::int as qty from pvp_inv
    where player_id = pid and item like 'wpn:musket:%' group by item
  loop
    select count(*)::int into have from pvp_gun_inst
      where player_id = pid and item = r.item and place in ('equip','bag');
    need := r.qty - have;
    if need > 0 then
      for i in 1..need loop
        insert into pvp_gun_inst (player_id, item, place, acc)
          values (pid, r.item, case when eq_item = r.item and not exists (
            select 1 from pvp_gun_inst where player_id = pid and place = 'equip'
          ) then 'equip' else 'bag' end, '{}'::jsonb);
      end loop;
    elsif need < 0 then
      -- Too many: drop empty bag copies first (never delete house / non-empty acc if possible).
      delete from pvp_gun_inst where gid in (
        select gid from pvp_gun_inst
        where player_id = pid and item = r.item and place = 'bag' and acc = '{}'::jsonb
        order by updated_at desc limit (-need)
      );
    end if;
  end loop;

  -- Drop bag/equip instances whose item is no longer in inv (sold / gifted / salvaged).
  delete from pvp_gun_inst g
    where g.player_id = pid and g.place in ('equip','bag')
      and not exists (select 1 from pvp_inv i where i.player_id = pid and i.item = g.item);

  return jsonb_build_object('ok', true,
    'guns', coalesce((select jsonb_agg(jsonb_build_object(
      'gid', gid, 'item', item, 'place', place,
      'cottage_id', cottage_id, 'house_slot', house_slot, 'acc', acc
    ) order by place, item, updated_at) from pvp_gun_inst where player_id = pid), '[]'::jsonb));
end $$;
revoke all on function public.pvp_gun_ensure(text) from public, anon, authenticated;

-- Fit / detach an attachment on one musket instance. Consumes / returns val:acc_* from pvp_inv.
create or replace function public.pvp_gun_acc_set(p_player text, p_gid uuid, p_slot text, p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pid text := public.pvp_main(p_player);
  g pvp_gun_inst; old text; want text;
begin
  if not pvp_flag('musket_rank') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  if p_slot not in ('scope','bayonet','stock','horn') then return jsonb_build_object('ok', false, 'why', 'bad slot'); end if;
  if not pvp_rl_hit('gacc:' || pid, 2, 1) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  select * into g from pvp_gun_inst where gid = p_gid and player_id = pid for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'no gun'); end if;
  if g.place = 'house' then return jsonb_build_object('ok', false, 'why', 'in storage'); end if;
  want := case p_slot when 'scope' then 'val:acc_scope' when 'bayonet' then 'val:acc_bayonet'
                      when 'stock' then 'val:acc_stock' else 'val:acc_horn' end;
  old := g.acc ->> p_slot;
  if p_key is null or p_key = '' then
    -- detach
    if old is null then return jsonb_build_object('ok', true, 'gid', g.gid, 'acc', g.acc, 'noop', true); end if;
    perform pvp_inv_add(pid, old, 1, 'chest', 'gun_acc_detach', g.gid::text);
    g.acc := g.acc - p_slot;
  else
    if p_key is distinct from want then return jsonb_build_object('ok', false, 'why', 'bad key'); end if;
    if old is not distinct from p_key then return jsonb_build_object('ok', true, 'gid', g.gid, 'acc', g.acc, 'noop', true); end if;
    -- consume new attachment from loose inventory
    if pvp_inv_take(pid, p_key, 1, 'gun_acc_fit', g.gid::text) is null then
      return jsonb_build_object('ok', false, 'why', 'not enough'); end if;
    if old is not null then
      perform pvp_inv_add(pid, old, 1, 'chest', 'gun_acc_swap', g.gid::text);
    end if;
    g.acc := coalesce(g.acc, '{}'::jsonb) || jsonb_build_object(p_slot, p_key);
  end if;
  if not pvp_gun_acc_ok(g.acc) then raise exception 'bad acc' using errcode = 'P0001'; end if;
  update pvp_gun_inst set acc = g.acc, updated_at = now() where gid = g.gid;
  return jsonb_build_object('ok', true, 'gid', g.gid, 'item', g.item, 'place', g.place, 'acc', g.acc);
exception when sqlstate 'P0001' then return jsonb_build_object('ok', false, 'why', sqlerrm);
end $$;
revoke all on function public.pvp_gun_acc_set(text, uuid, text, text) from public, anon, authenticated;

-- Equip a specific musket instance (moves place equip↔bag; keeps acc on each copy).
create or replace function public.pvp_gun_equip(p_player text, p_gid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pid text := public.pvp_main(p_player);
  g pvp_gun_inst; prev uuid;
begin
  if not pvp_flag('musket_rank') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  select * into g from pvp_gun_inst where gid = p_gid and player_id = pid for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'no gun'); end if;
  if g.place = 'house' then return jsonb_build_object('ok', false, 'why', 'in storage'); end if;
  if g.place = 'equip' then
    update pvp_inv_equip set item = g.item where player_id = pid and slot = 'musket';
    insert into pvp_inv_equip (player_id, slot, item) values (pid, 'musket', g.item)
      on conflict (player_id, slot) do update set item = excluded.item;
    return jsonb_build_object('ok', true, 'gid', g.gid, 'item', g.item, 'acc', g.acc, 'slot', 'musket');
  end if;
  select gid into prev from pvp_gun_inst where player_id = pid and place = 'equip';
  if prev is not null then
    update pvp_gun_inst set place = 'bag', updated_at = now() where gid = prev;
  end if;
  update pvp_gun_inst set place = 'equip', cottage_id = null, house_slot = null, updated_at = now() where gid = g.gid;
  insert into pvp_inv_equip (player_id, slot, item) values (pid, 'musket', g.item)
    on conflict (player_id, slot) do update set item = excluded.item;
  return jsonb_build_object('ok', true, 'gid', g.gid, 'item', g.item, 'acc', g.acc, 'slot', 'musket',
    'prev', prev);
end $$;
revoke all on function public.pvp_gun_equip(text, uuid) from public, anon, authenticated;

-- Patch house_store: when depositing a musket with p_gid, move that instance's acc into meta.
create or replace function public.pvp_house_store_gun(p_player text, p_cottage text, p_gid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pid text := public.pvp_main(p_player); h pvp_houses; g pvp_gun_inst; dest int; used int;
  meta jsonb;
begin
  if not pvp_flag('houses') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
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

-- On house_take of a musket: restore gun_inst from meta.acc / meta.gid.
create or replace function public.pvp_gun_from_house(p_player text, p_cottage text, p_slot integer, p_item text, p_meta jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  pid text := public.pvp_main(p_player);
  gid uuid; acc jsonb := coalesce(p_meta->'acc', '{}'::jsonb);
begin
  if p_item !~ '^wpn:musket:' then return; end if;
  if not pvp_gun_acc_ok(acc) then acc := '{}'::jsonb; end if;
  begin gid := nullif(p_meta->>'gid', '')::uuid; exception when others then gid := null; end;
  if gid is not null and exists (select 1 from pvp_gun_inst where gid = gid and player_id = pid) then
    update pvp_gun_inst set place = 'bag', cottage_id = null, house_slot = null, acc = acc, item = p_item, updated_at = now()
      where gid = gid and player_id = pid;
  else
    insert into pvp_gun_inst (player_id, item, place, acc) values (pid, p_item, 'bag', acc);
  end if;
end $$;
revoke all on function public.pvp_gun_from_house(text, text, integer, text, jsonb) from public, anon, authenticated;

-- Salvage: return fitted attachments before destroying the musket copy.
create or replace function public.pvp_gun_return_acc(p_player text, p_item text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pid text := public.pvp_main(p_player); g pvp_gun_inst; k text; v text; got jsonb := '[]'::jsonb;
begin
  -- Prefer a bag copy (not the sole equipped one) matching the item, matching salvage rules.
  select * into g from pvp_gun_inst
    where player_id = pid and item = p_item and place = 'bag'
    order by case when acc = '{}'::jsonb then 1 else 0 end, updated_at
    limit 1 for update;
  if not found then
    -- last resort: equipped only if another copy remains (salvage SQL already guards this)
    select * into g from pvp_gun_inst where player_id = pid and item = p_item and place = 'equip' for update;
  end if;
  if not found then return jsonb_build_object('ok', true, 'items', got); end if;
  for k, v in select * from jsonb_each_text(coalesce(g.acc, '{}'::jsonb)) loop
    perform pvp_inv_add(pid, v, 1, 'chest', 'gun_acc_salvage', g.gid::text);
    got := got || jsonb_build_array(jsonb_build_object('item', v, 'qty', 1));
  end loop;
  delete from pvp_gun_inst where gid = g.gid;
  return jsonb_build_object('ok', true, 'items', got, 'gid', g.gid);
end $$;
revoke all on function public.pvp_gun_return_acc(text, text) from public, anon, authenticated;

-- Rank-up: keep acc on the upgraded musket instance.
create or replace function public.pvp_gun_rank_follow(p_player text, p_from text, p_to text)
returns void language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); g pvp_gun_inst;
begin
  select * into g from pvp_gun_inst where player_id = pid and item = p_from
    order by case place when 'equip' then 0 when 'bag' then 1 else 2 end, updated_at limit 1 for update;
  if found then
    update pvp_gun_inst set item = p_to, updated_at = now() where gid = g.gid;
  end if;
end $$;
revoke all on function public.pvp_gun_rank_follow(text, text, text) from public, anon, authenticated;

-- Wrap existing musk_rank / musk_salvage to preserve / return attachments (replace bodies).
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
  perform pvp_gun_rank_follow(pid, p_item, out_item);
  update pvp_inv_equip set item = out_item where player_id = pid and slot = 'musket' and item = p_item
    and not exists (select 1 from pvp_inv where player_id = pid and item = p_item);
  return jsonb_build_object('ok', true, 'item', out_item, 'from', p_item, 'price', case when p_owner then 0 else p_gold end, 'parts', case when p_owner then 0 else p_parts end);
exception when sqlstate 'P0001' then return jsonb_build_object('ok', false, 'why', sqlerrm);
end $$;

create or replace function public.pvp_inv_musk_salvage(p_player text, p_item text, p_parts integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); have integer; ret jsonb;
begin
  if not pvp_flag('musket_rank') then return jsonb_build_object('ok', false, 'why', 'rank closed'); end if;
  if p_item !~ '^wpn:musket:[a-z_]{2,16}:(common|rare|epic|legendary)$' or p_parts not between 1 and 20 then return jsonb_build_object('ok', false, 'why', 'bad item'); end if;
  if not pvp_rl_hit('msalv:' || pid, 2, 1) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  select coalesce(sum(qty), 0) into have from pvp_inv where player_id = pid and item = p_item;
  if have <= 1 and exists (select 1 from pvp_inv_equip where player_id = pid and slot = 'musket' and item = p_item) then return jsonb_build_object('ok', false, 'why', 'equipped'); end if;
  ret := pvp_gun_return_acc(pid, p_item);
  if pvp_inv_take(pid, p_item, 1, 'musk_salvage') is null then return jsonb_build_object('ok', false, 'why', 'not enough'); end if;
  perform pvp_inv_add(pid, 'val:musket_parts', p_parts, 'find', 'musk_salvage', p_item);
  return jsonb_build_object('ok', true, 'parts', p_parts, 'returned', coalesce(ret->'items', '[]'::jsonb));
end $$;

-- Patch house_take / house_take_capped to call pvp_gun_from_house after withdraw.
create or replace function public.pvp_house_take(p_player text, p_cottage text, p_slot integer, p_qty integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pid text := public.pvp_main(p_player); r pvp_house_storage; q integer; src text;
begin
  if not pvp_flag('houses') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
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

create or replace function public.pvp_house_take_capped(
  p_player text, p_cottage text, p_slot integer, p_qty integer, p_cap integer, p_owner boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pid text := public.pvp_main(p_player); r pvp_house_storage; q integer; src text;
  used integer; room integer;
begin
  if not pvp_flag('houses') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
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

commit;
