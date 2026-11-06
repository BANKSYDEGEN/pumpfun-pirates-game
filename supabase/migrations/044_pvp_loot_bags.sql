-- PUMPFUN PIRATES · migration 044 (backpack-pvp): PvP loot bags for unequipped haul dropped on on-foot PvP death.
-- ADDITIVE ONLY. Client kill switch: &pvploot=0. Edge: supabase/functions/pvp/loot.ts (pvp_drop_haul / pvp_claim_loot / pvp_loot_list).
-- Equipped sword/musket, cosmetics (pvp_owned), maps (pvp_maps), and cottage chests (pvp_house_storage) are NEVER moved here.
begin;

insert into public.pvp_flags (k, on_, note) values
  ('pvploot', true, 'on-foot PvP loot bags for unequipped haul (044)'),
  ('bagcap', true, '16-slot backpack haul cap; owner unlimited (044)'),
  ('safezones', true, 'island safe zones (harbor/cottage/hill/swim) (044)')
  on conflict (k) do nothing;

create table if not exists public.pvp_loot_bags (
  id           uuid primary key default gen_random_uuid(),
  x            double precision not null,
  y            double precision not null default 0,
  z            double precision not null,
  room         text not null default 'island' check (char_length(room) between 1 and 24),
  victim_id    text not null,
  victim_name  text not null default 'PIRATE' check (char_length(victim_name) between 1 and 24),
  killer_id    text,
  items        jsonb not null default '[]'::jsonb,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);
create index if not exists pvp_loot_bags_room_exp_idx on public.pvp_loot_bags (room, expires_at);
create index if not exists pvp_loot_bags_victim_idx on public.pvp_loot_bags (victim_id);
alter table public.pvp_loot_bags enable row level security;
revoke all on public.pvp_loot_bags from public, anon, authenticated;

-- House withdraw respects backpack cap (owner / flag-off = unlimited). Additive overload via new RPC.
create or replace function public.pvp_house_take_capped(
  p_player text, p_cottage text, p_slot integer, p_qty integer, p_cap integer, p_owner boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pid text := public.pvp_main(p_player);
  h pvp_houses; r pvp_house_storage;
  q integer := greatest(1, least(coalesce(p_qty, 1), 999));
  used integer := 0; need_new boolean := true; eq_item text;
  cap integer := coalesce(p_cap, 16);
begin
  if not pvp_flag('houses') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  if p_cottage is null or p_slot is null then return jsonb_build_object('ok', false, 'why', 'bad take'); end if;
  select * into h from pvp_houses where player_id = pid and cottage_id = p_cottage for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'not owned'); end if;
  select * into r from pvp_house_storage where player_id = pid and cottage_id = p_cottage and slot = p_slot for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'empty'); end if;
  q := least(q, r.qty);

  -- Cap check (owner / bagcap off / p_owner = skip)
  if not coalesce(p_owner, false) and pvp_flag('bagcap') and cap > 0 then
    -- count backpack slots (exclude equipped sword/musket)
    select count(*)::int into used from (
      select i.item from pvp_inv i
      where i.player_id = pid
        and not exists (
          select 1 from pvp_inv_equip e
          where e.player_id = pid and e.item = i.item and e.slot in ('sword','musket')
            and (select coalesce(sum(qty),0) from pvp_inv where player_id = pid and item = i.item) <= 1
        )
      group by i.item
    ) s;
    -- weapons: each unit is a slot — approximate with sum of wpn qty minus equipped
    select coalesce(sum(case when item like 'wpn:%' then qty else 1 end), 0)::int into used
      from (
        select item, sum(qty) as qty from pvp_inv where player_id = pid group by item
      ) t
      where item not in (select item from pvp_inv_equip where player_id = pid and slot in ('sword','musket'));
    -- stackable already held?
    need_new := not exists (
      select 1 from pvp_inv where player_id = pid and item = r.item
    ) or r.item like 'wpn:%';
    if need_new and used >= cap then
      return jsonb_build_object('ok', false, 'why', 'Backpack full (16/16) — stash or sell items first!', 'full', true, 'used', used, 'cap', cap);
    end if;
  end if;

  if r.qty = q then delete from pvp_house_storage where player_id = pid and cottage_id = p_cottage and slot = p_slot;
  else update pvp_house_storage set qty = r.qty - q, updated_at = now() where player_id = pid and cottage_id = p_cottage and slot = p_slot;
  end if;
  perform pvp_inv_add(pid, r.item, q, 'house', 'house_take', p_cottage);
  return jsonb_build_object('ok', true, 'item', r.item, 'qty', q);
end $$;
revoke all on function public.pvp_house_take_capped(text, text, integer, integer, integer, boolean) from public, anon, authenticated;

commit;

-- =====================================================================================================================
-- [backpack-pvp] t1694u SERVER PICKER: pvp_harbor_core keeps its 6-arg signature (the pvp_harbor wrapper is unchanged and
-- already forwards p_want_copy). Backwards compatible: null / 0 = auto (unchanged), 1..60 = a chosen public copy (now also
-- an EMPTY one, still under cap + inside the Realtime budget), -1 = lowest empty copy (+ NEW PUBLIC SERVER). Own / private
-- servers are just prefixes pfp-harbor-<code> ([a-z0-9]{2,12}, lowercased by the client), already allowed by the regex.
-- =====================================================================================================================
create or replace function public.pvp_harbor_core(p_seat text, p_prefix text, p_op text, p_name text default null, p_cap int default null, p_want_copy int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rate constant numeric := 1.5; total_max constant numeric := 95; harbor_max constant numeric := 60; max_copies constant int := 60;
  cap int; r pvp_harbor_seats; c int; n int; s int; arena numeric; hb numeric; room_load numeric; delta numeric; victim pvp_harbor_seats; free_c int;
  want int;
begin
  if p_seat is null or char_length(p_seat) not between 12 and 40 or p_prefix is null or p_prefix !~ '^pfp-harbor(-[a-zA-Z0-9]{1,16})?$'
     or p_op not in ('beat', 'spec', 'peek', 'leave') then
    return jsonb_build_object('state', 'error');
  end if;
  perform pg_advisory_xact_lock(hashtext('pvp_harbor'));
  delete from pvp_harbor_seats where seen < now() - interval '20 seconds';
  cap := (case when p_prefix = 'pfp-harbor' then 4 else least(greatest(coalesce(p_cap, 4), 1), 4) end);
  arena := pvp_lobby_load();
  -- [backpack-pvp] -1 = + NEW PUBLIC SERVER (lowest EMPTY copy) · 1..60 = JOIN that copy (even an empty one) when under cap + in budget
  want := case when p_want_copy = -1 then -1 when p_want_copy is not null and p_want_copy between 1 and max_copies then p_want_copy else null end;

  if p_op = 'leave' then
    delete from pvp_harbor_seats where seat = p_seat;
    return jsonb_build_object('state', 'left');
  end if;

  select * into r from pvp_harbor_seats where seat = p_seat;
  if found then
    update pvp_harbor_seats set seen = now(), name = coalesce(left(p_name, 20), name) where seat = p_seat;
    if r.prefix <> p_prefix or (p_op = 'beat' and r.state <> 'play') or (p_op = 'spec' and r.state <> 'spec') then
      delete from pvp_harbor_seats where seat = p_seat; r := null;
    end if;
  end if;

  if p_op = 'beat' then
    hb := pvp_harbor_load();
    if arena + hb > total_max or hb > harbor_max then
      select h.* into victim from pvp_harbor_seats h
        where h.state = 'play' and (select count(*) from pvp_harbor_seats x where x.prefix = h.prefix and x.copy = h.copy) >= 2
        order by h.joined desc limit 1;
      if victim.seat is not null then
        select min(g) into free_c from generate_series(1, max_copies) g
          where not exists (select 1 from pvp_harbor_seats x where x.prefix = victim.prefix and x.copy = g);
        if free_c is not null then update pvp_harbor_seats set copy = free_c, joined = clock_timestamp() where seat = victim.seat; end if;
      end if;
    end if;
    if r.seat is null then
      hb := pvp_harbor_load(); c := null;
      -- preferred copy (Squad Hall JOIN WORLD): only if occupied, under cap, and budget allows
      if want = -1 then
        select min(g) into free_c from generate_series(1, max_copies) g
          where not exists (select 1 from pvp_harbor_seats x where x.prefix = p_prefix and x.copy = g);
        if free_c is not null and arena + hb + rate <= total_max and hb + rate <= harbor_max then c := free_c; end if;
      elsif want is not null then
        select count(*) filter (where state = 'play'), count(*) filter (where state = 'spec') into n, s
          from pvp_harbor_seats where prefix = p_prefix and copy = want;
        n := coalesce(n, 0); s := coalesce(s, 0);
        if n < cap then -- [backpack-pvp] empty copies too (server picker)
          room_load := (case when n + s >= 2 then n * rate * (n + s) else 0 end);
          delta := (n + 1) * rate * (n + 1 + s) - room_load;
          if arena + hb + delta <= total_max and hb + delta <= harbor_max then c := want; end if;
        end if;
      end if;
      if c is null then
        for c, n, s in
          select copy, count(*) filter (where state = 'play'), count(*) filter (where state = 'spec') from pvp_harbor_seats
            where prefix = p_prefix group by copy order by copy
        loop
          if n >= 1 and n < cap then
            room_load := (case when n + s >= 2 then n * rate * (n + s) else 0 end);
            delta := (n + 1) * rate * (n + 1 + s) - room_load;
            if arena + hb + delta <= total_max and hb + delta <= harbor_max then exit; end if;
          end if;
          c := null;
        end loop;
      end if;
      if c is null then
        select min(g) into c from generate_series(1, max_copies) g
          where not exists (select 1 from pvp_harbor_seats x where x.prefix = p_prefix and x.copy = g);
      end if;
      if c is null then return jsonb_build_object('state', 'full'); end if;
      insert into pvp_harbor_seats (seat, prefix, copy, state, name) values (p_seat, p_prefix, c, 'play', coalesce(left(p_name, 20), 'PIRATE'));
    end if;
  elsif p_op = 'spec' then
    if r.seat is null then
      select copy, count(*) filter (where state = 'play'), count(*) filter (where state = 'spec') into c, n, s from pvp_harbor_seats
        where prefix = p_prefix group by copy having count(*) filter (where state = 'play') > 0 order by 2 desc, copy limit 1;
      if c is null then return jsonb_build_object('state', 'empty', 'pirates', 0); end if;
      hb := pvp_harbor_load();
      delta := n * rate * (n + s + 1) - (case when n + s >= 2 then n * rate * (n + s) else 0 end);
      if arena + hb + delta > total_max or hb + delta > harbor_max then return jsonb_build_object('state', 'full', 'why', 'spectators'); end if;
      insert into pvp_harbor_seats (seat, prefix, copy, state, name) values (p_seat, p_prefix, c, 'spec', coalesce(left(p_name, 20), 'PIRATE'));
    end if;
  end if;

  select * into r from pvp_harbor_seats where seat = p_seat;
  return jsonb_build_object(
    'state', (case when p_op = 'peek' then 'peek' when r.seat is null then 'none' else r.state end),
    'copy', r.copy,
    'n', (select count(*) from pvp_harbor_seats where prefix = p_prefix and copy = r.copy and state = 'play'),
    's', (select count(*) from pvp_harbor_seats where prefix = p_prefix and copy = r.copy and state = 'spec'),
    'cap', cap,
    'pirates', (select count(*) from pvp_harbor_seats where prefix = p_prefix and state = 'play'),
    'copies', (select coalesce(jsonb_agg(jsonb_build_array(t.copy, t.k) order by t.copy), '[]'::jsonb)
               from (select h.copy, count(*) filter (where h.state = 'play') k from pvp_harbor_seats h where h.prefix = p_prefix group by h.copy) t),
    'load', round(arena + pvp_harbor_load(), 1));
end;
$$;
