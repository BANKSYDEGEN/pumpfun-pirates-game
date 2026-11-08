-- BANKSY: voluntary ground drops + transaction-safe loot claims. Apply before deploying pvp.
begin;
alter table public.pvp_loot_bags add column if not exists manual boolean not null default false;
alter table public.pvp_loot_bags add column if not exists sea boolean not null default false;
alter table public.pvp_loot_bags add column if not exists room_key text;
alter table public.pvp_loot_bags add column if not exists gun_id uuid;
create index if not exists pvp_loot_manual_room_idx on public.pvp_loot_bags(room_key, expires_at) where manual;
create table if not exists public.pvp_manual_drop_rate (
  id uuid primary key, player_id text not null, created_at timestamptz not null default clock_timestamp()
);
create index if not exists pvp_manual_drop_rate_player_idx on public.pvp_manual_drop_rate(player_id, created_at);
alter table public.pvp_manual_drop_rate enable row level security;
revoke all on public.pvp_manual_drop_rate from public, anon, authenticated;

-- Capability probe is also a reconnect/late-join list. A missing RPC hides DROP on old deployments.
create or replace function public.pvp_manual_loot_status(p_room text)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object('ok', true, 'manualDrops', pvp_flag('pvploot'), 'bags', coalesce((
    select jsonb_agg(to_jsonb(b)) from public.pvp_loot_bags b
    where b.manual and b.room_key = p_room and b.expires_at > now()
  ), '[]'::jsonb));
$$;

create or replace function public.pvp_manual_drop(
  p_pid text, p_item text, p_qty integer, p_x double precision, p_y double precision,
  p_z double precision, p_room text, p_sea boolean, p_id uuid, p_gid uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare b pvp_loot_bags; g pvp_gun_inst; n integer; pname text;
begin
  if not pvp_flag('pvploot') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  if p_item is null or p_item !~ '^(fish|val|wpn|dup|isl):' or p_qty is null or p_qty not between 1 and 999
    or (p_item like 'wpn:%' and p_qty <> 1) or p_id is null
    or p_room is null or p_room !~ '^pfp-harbor(-[a-zA-Z0-9]{1,16})?-[1-9][0-9]?$'
    or p_x is null or not (p_x between -5000 and 5000) or p_z is null or not (p_z between -5000 and 5000)
    or p_y is null or not (p_y between -5 and 80) then
    return jsonb_build_object('ok', false, 'why', 'bad drop');
  end if;
  perform pg_advisory_xact_lock(hashtext('manual-loot:' || p_pid));
  if exists(select 1 from pvp_manual_drop_rate where id = p_id) then
    return jsonb_build_object('ok', false, 'why', 'already dropped');
  end if;
  select count(*) into n from pvp_manual_drop_rate where player_id = p_pid and created_at > clock_timestamp() - interval '10 seconds';
  if n >= 3 then return jsonb_build_object('ok', false, 'why', 'Wait a moment: 3 drops per 10 seconds'); end if;
  delete from pvp_gun_inst where player_id in (
    select 'loot:' || id::text from pvp_loot_bags where manual and expires_at <= now()
  );
  delete from pvp_loot_bags where manual and expires_at <= now();
  select count(*) into n from pvp_loot_bags where manual and victim_id=p_pid and expires_at>now();
  if n>=12 then return jsonb_build_object('ok',false,'why','Pick up an existing drop first (12 active bags maximum)'); end if;
  -- Lock the actual inventory before checking equipment and taking, not any client-provided list.
  perform 1 from pvp_inv where player_id = p_pid and item = p_item for update;
  if exists(select 1 from pvp_inv_equip where player_id = p_pid and item = p_item and slot in ('sword','musket')) then
    return jsonb_build_object('ok', false, 'why', 'Unequip this weapon first');
  end if;
  if p_item like 'wpn:musket:%' then
    perform pvp_gun_ensure(p_pid);
    select * into g from pvp_gun_inst where player_id = p_pid and item = p_item and place = 'bag'
      and (p_gid is null or gid = p_gid) order by updated_at, gid limit 1 for update;
    if not found then return jsonb_build_object('ok', false, 'why', 'musket not in backpack'); end if;
  end if;
  if pvp_inv_take(p_pid, p_item, p_qty, 'manual_drop', p_id::text) is null then
    return jsonb_build_object('ok', false, 'why', 'Not enough tradeable items');
  end if;
  select left(name,24) into pname from pvp_players where id = p_pid;
  insert into pvp_loot_bags(id,x,y,z,room,victim_id,victim_name,items,expires_at,manual,sea,room_key,gun_id)
    values(p_id,p_x,p_y,p_z,case when p_sea then 'sea' else 'island' end,p_pid,coalesce(nullif(pname,''),'PIRATE'),
      jsonb_build_array(jsonb_build_object('item',p_item,'qty',p_qty)),clock_timestamp()+interval '5 minutes',true,p_sea,p_room,g.gid)
    returning * into b;
  -- Keep fitted attachments on the same gun; escrow ownership prevents a stale gun instance being re-used.
  if g.gid is not null then update pvp_gun_inst set player_id = 'loot:' || p_id::text, updated_at=now() where gid=g.gid; end if;
  insert into pvp_manual_drop_rate(id,player_id) values(p_id,p_pid);
  delete from pvp_manual_drop_rate where created_at < now() - interval '1 day';
  return jsonb_build_object('ok',true,'bag',to_jsonb(b));
end $$;

-- Bag lock + player lock + all adds + leftovers in ONE transaction; failures roll everything back.
-- Used for both death and voluntary bags. No client-supplied items/equipped/cap/owner are accepted by edge.
create or replace function public.pvp_claim_loot_atomic(p_pid text, p_bag uuid, p_room text, p_owner boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b pvp_loot_bags; r record; it jsonb; held integer; eq integer; used integer; q integer; got integer;
  taken jsonb := '[]'::jsonb; remaining jsonb := '[]'::jsonb;
begin
  if not pvp_flag('pvploot') then return jsonb_build_object('ok',false,'why','closed'); end if;
  perform pg_advisory_xact_lock(hashtext('manual-loot:' || p_pid));
  select * into b from pvp_loot_bags where id=p_bag for update;
  if not found then return jsonb_build_object('ok',false,'why','gone'); end if;
  if b.manual and b.room_key is distinct from p_room then return jsonb_build_object('ok',false,'why','wrong harbor'); end if;
  if b.expires_at <= clock_timestamp() then
    delete from pvp_gun_inst where gid=b.gun_id and player_id='loot:' || b.id::text;
    delete from pvp_loot_bags where id=b.id;
    return jsonb_build_object('ok',false,'why','expired');
  end if;
  -- Inventory row locks also serialize concurrent takes on existing stacks.
  perform 1 from pvp_inv where player_id=p_pid for update;
  for it in select value from jsonb_array_elements(b.items) loop
    q := (it->>'qty')::integer;
    if q < 1 or it->>'item' is null then raise exception 'invalid loot item'; end if;
    select coalesce(sum(case when t.item like 'wpn:%' then greatest(0,t.qty-t.eq) else case when t.qty>t.eq then 1 else 0 end end),0)::int
      into used from (select i.item, sum(i.qty) qty,
        (select count(*) from pvp_inv_equip e where e.player_id=p_pid and e.item=i.item and e.slot in ('sword','musket')) eq
        from pvp_inv i where i.player_id=p_pid and i.item not like 'map:%' group by i.item) t;
    select coalesce(sum(qty),0) into held from pvp_inv where player_id=p_pid and item=it->>'item';
    select count(*) into eq from pvp_inv_equip where player_id=p_pid and item=it->>'item' and slot in ('sword','musket');
    if p_owner then got := q;
    elsif (it->>'item') like 'wpn:%' then got := least(q,greatest(0,16-used));
    elsif held>eq or used<16 then got := q;
    else got := 0; end if;
    if got > 0 then
      perform pvp_inv_add(p_pid,it->>'item',got,'loot','pvp_claim',b.id::text);
      taken := taken || jsonb_build_array(jsonb_build_object('item',it->>'item','qty',got));
      if b.gun_id is not null then
        update pvp_gun_inst set player_id=p_pid,place='bag',updated_at=now() where gid=b.gun_id and player_id='loot:' || b.id::text;
        if not found then raise exception 'missing escrow musket'; end if;
      end if;
    end if;
    if got<q then remaining := remaining || jsonb_build_array(jsonb_build_object('item',it->>'item','qty',q-got)); end if;
  end loop;
  if taken='[]'::jsonb then return jsonb_build_object('ok',false,'why','Backpack full (16/16) — stash or sell items first!','full',true); end if;
  if remaining='[]'::jsonb then delete from pvp_loot_bags where id=b.id; b := null;
  else update pvp_loot_bags set items=remaining where id=b.id returning * into b; end if;
  return jsonb_build_object('ok',true,'take',taken,'left',remaining,'bag',case when b.id is null then null else to_jsonb(b) end,'bag_id',p_bag);
end $$;
revoke all on function public.pvp_manual_loot_status(text), public.pvp_manual_drop(text,text,integer,double precision,double precision,double precision,text,boolean,uuid,uuid), public.pvp_claim_loot_atomic(text,uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.pvp_manual_loot_status(text), public.pvp_manual_drop(text,text,integer,double precision,double precision,double precision,text,boolean,uuid,uuid), public.pvp_claim_loot_atomic(text,uuid,text,boolean) to service_role;
-- Storage RPCs already accept exact quantities. Correct the existing capped take's stack-vs-unit clamp
-- so withdrawing 48 idols is 48, not the number of empty backpack slots. Applies to BOTH chests.
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
    select coalesce(sum(case when t.item like 'wpn:%' then greatest(0,t.qty-t.eq) else case when t.qty>t.eq then 1 else 0 end end),0)::int
      into used from (select i.item, sum(i.qty) qty,
        (select count(*) from pvp_inv_equip e where e.player_id=pid and e.item=i.item and e.slot in ('sword','musket')) eq
        from pvp_inv i where i.player_id=pid and i.item not like 'map:%' group by i.item) t;
    -- A stack uses ONE slot, not one slot per unit. Existing stacks need no extra slot.
    if (r.item like 'wpn:%' or not exists(select 1 from pvp_inv where player_id=pid and item=r.item)) and used >= p_cap then
      return jsonb_build_object('ok', false, 'why', 'backpack full');
    end if;
  end if;
  src := public.pvp_house_inv_source(r.meta);
  perform pvp_inv_add(pid, r.item, q, src, 'house_take', p_cottage);
  perform pvp_gun_from_house(pid, p_cottage, p_slot, r.item, r.meta);
  if q >= r.qty then delete from pvp_house_storage where player_id = pid and cottage_id = p_cottage and slot = p_slot;
  else update pvp_house_storage set qty = qty - q where player_id = pid and cottage_id = p_cottage and slot = p_slot; end if;
  return jsonb_build_object('ok', true, 'item', r.item, 'qty', q, 'meta', coalesce(r.meta, '{}'::jsonb));
end $$;
revoke all on function public.pvp_house_take_capped(text,text,integer,integer,integer,boolean) from public, anon, authenticated;
grant execute on function public.pvp_house_take_capped(text,text,integer,integer,integer,boolean) to service_role;
commit;
