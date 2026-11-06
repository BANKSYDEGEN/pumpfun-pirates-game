-- PUMPFUN PIRATES · migration 045 (admin-menu): the OWNER's Admin Menu (BANKSY t1700u / t1701u). ADDITIVE ONLY.
-- Edge: supabase/functions/pvp/admin.ts (admin_status / admin_players / admin_freeze / admin_pocket_get / admin_pocket_take /
-- admin_pocket_give / admin_pocket_gold: owner only, 403 for everyone else) + admin_register_net / admin_my_state (any pirate, about THEMSELVES).
-- Client: js/adminMenu.js (kill switch &admin=0). Nothing here is reachable by anon / authenticated: only the Edge Function's service role.
--   * pvp_admin_presence: each pirate's own (net id -> pid) + where they are, written by THAT pirate's device (admin_register_net), so the
--     owner's roster can map a peer's network id to the persistent pid the freeze / pockets act on. A net id bound to another pid in
--     pvp_net (006, the ticket binding) or here is refused (no hijacking someone else's id).
--   * pvp_admin_controls: the SERVER-side freeze (target pid, expiry). A Realtime 'adm' poke only makes the target re-ask admin_my_state:
--     a peer broadcast can never freeze anyone.
--   * pvp_admin_pocket_take / _give / _gold: atomic item + gold moves (pvp_inv rows locked FOR UPDATE, audit rows in pvp_inv_log).
--     Gold rides the 036 pot (pvp_inv_owner_pot): the target's game collects it with inv_pot on the poke (negative = confiscated).
begin;

create table if not exists public.pvp_admin_presence (
  net_id     text primary key check (net_id ~ '^[a-z0-9]{6,20}$'),
  pid        text not null,
  name       text,
  room       text,
  mode       text,
  x          real,
  y          real,
  z          real,
  updated_at timestamptz not null default now()
);
create index if not exists pvp_admin_presence_pid_idx on public.pvp_admin_presence (pid, updated_at desc);
create index if not exists pvp_admin_presence_seen_idx on public.pvp_admin_presence (updated_at desc);
alter table public.pvp_admin_presence enable row level security;
revoke all on public.pvp_admin_presence from public, anon, authenticated;

create table if not exists public.pvp_admin_controls (
  target_pid text primary key,
  target_net text,
  frozen     boolean not null default false,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.pvp_admin_controls enable row level security;
revoke all on public.pvp_admin_controls from public, anon, authenticated;

-- a device registers ITS OWN net id (pid comes from whoAmI in the Edge Function, never from the body)
create or replace function public.pvp_admin_register(p_net text, p_pid text, p_name text, p_room text, p_mode text, p_x real, p_y real, p_z real)
returns jsonb language plpgsql security definer set search_path = public as $$
declare bound text;
begin
  if p_net is null or p_net !~ '^[a-z0-9]{6,20}$' or p_pid is null then return jsonb_build_object('ok', false, 'why', 'bad net'); end if;
  if not pvp_rl_hit('admreg:' || p_pid, 60, 12) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  select player_id into bound from pvp_net where net_id = p_net;
  if bound is not null and pvp_main(bound) <> p_pid then return jsonb_build_object('ok', false, 'why', 'not yours'); end if;
  select pid into bound from pvp_admin_presence where net_id = p_net;
  if bound is not null and bound <> p_pid then return jsonb_build_object('ok', false, 'why', 'not yours'); end if;
  insert into pvp_admin_presence (net_id, pid, name, room, mode, x, y, z, updated_at)
    values (p_net, p_pid, left(p_name, 20), left(p_room, 24), left(p_mode, 12), p_x, p_y, p_z, now())
    on conflict (net_id) do update set name = excluded.name, room = excluded.room, mode = excluded.mode, x = excluded.x, y = excluded.y, z = excluded.z, updated_at = now();
  delete from pvp_admin_presence where updated_at < now() - interval '1 day';
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.pvp_admin_register(text, text, text, text, text, real, real, real) from public, anon, authenticated;

-- take p_qty (null / 0 = all) of an item out of the target's pockets, into the OWNER's. Every source (the owner's call).
create or replace function public.pvp_admin_pocket_take(p_owner text, p_target text, p_item text, p_qty integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tgt text := public.pvp_main(p_target); r record; have integer; need integer; k integer; mid uuid;
begin
  if p_owner is distinct from pvp_inv_owner() then return jsonb_build_object('ok', false, 'why', 'owner only'); end if;
  if tgt is null or tgt = p_owner then return jsonb_build_object('ok', false, 'why', 'bad target'); end if;
  if p_item ~ '^map:[0-9a-f-]{36}$' then
    select id into mid from pvp_maps where id = substr(p_item, 5)::uuid and player_id = tgt and dug_at is null for update;
    if mid is null then return jsonb_build_object('ok', false, 'why', 'not there'); end if;
    update pvp_maps set player_id = p_owner, via = 'gift' where id = mid;
    insert into pvp_inv_log (player_id, item, delta, why, ref) values (tgt, p_item, -1, 'admin_take', p_owner), (p_owner, p_item, 1, 'admin_take', tgt);
    return jsonb_build_object('ok', true, 'item', p_item, 'qty', 1, 'left', 0);
  end if;
  select coalesce(sum(qty), 0) into have from (select qty from pvp_inv where player_id = tgt and item = p_item for update) s;
  if have < 1 then return jsonb_build_object('ok', false, 'why', 'not there'); end if;
  need := case when coalesce(p_qty, 0) < 1 then have else least(p_qty, have) end; k := need;
  for r in select source, qty from pvp_inv where player_id = tgt and item = p_item order by case source when 'carry_buy' then 1 else 0 end, source loop
    exit when need = 0;
    if r.qty <= need then delete from pvp_inv where player_id = tgt and item = p_item and source = r.source; need := need - r.qty;
      insert into pvp_inv_log (player_id, item, delta, source, why, ref) values (tgt, p_item, -r.qty, r.source, 'admin_take', p_owner);
    else update pvp_inv set qty = qty - need, updated_at = now() where player_id = tgt and item = p_item and source = r.source;
      insert into pvp_inv_log (player_id, item, delta, source, why, ref) values (tgt, p_item, -need, r.source, 'admin_take', p_owner); need := 0; end if;
  end loop;
  perform pvp_inv_add(p_owner, p_item, k, 'gift', 'admin_take', tgt);
  return jsonb_build_object('ok', true, 'item', p_item, 'qty', k, 'left', have - k);
end $$;
revoke all on function public.pvp_admin_pocket_take(text, text, text, integer) from public, anon, authenticated;

-- slip items into the target's pockets (source 'gift': tradeable like any gift)
create or replace function public.pvp_admin_pocket_give(p_owner text, p_target text, p_item text, p_qty integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tgt text := public.pvp_main(p_target); q integer := greatest(1, least(coalesce(p_qty, 1), 99));
begin
  if p_owner is distinct from pvp_inv_owner() then return jsonb_build_object('ok', false, 'why', 'owner only'); end if;
  if tgt is null then return jsonb_build_object('ok', false, 'why', 'bad target'); end if;
  if p_item is null or p_item !~ '^(fish:[a-z_]{2,16}|val:[a-z_]{2,20}|wpn:(sword|musket):[a-z_]{2,16}:(common|rare|epic|legendary)|dup:[a-z]{2,10}:[a-z0-9_]{2,24}:(common|uncommon|rare|epic|legendary))$' then
    return jsonb_build_object('ok', false, 'why', 'bad item'); end if;
  perform pvp_inv_add(tgt, p_item, q, 'gift', 'admin_give', p_owner);
  return jsonb_build_object('ok', true, 'item', p_item, 'qty', q, 'have', (select coalesce(sum(qty), 0) from pvp_inv where player_id = tgt and item = p_item));
end $$;
revoke all on function public.pvp_admin_pocket_give(text, text, text, integer) from public, anon, authenticated;

-- gold: + = into their pot (their game collects it), - = confiscated (their pot goes negative, the owner's pot gets it)
create or replace function public.pvp_admin_gold(p_owner text, p_target text, p_delta integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tgt text := public.pvp_main(p_target); d integer := greatest(-1000000, least(coalesce(p_delta, 0), 1000000)); pot bigint;
begin
  if p_owner is distinct from pvp_inv_owner() then return jsonb_build_object('ok', false, 'why', 'owner only'); end if;
  if tgt is null or tgt = p_owner or d = 0 then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
  insert into pvp_inv_owner_pot (player_id, gold) values (tgt, d) on conflict (player_id) do update set gold = pvp_inv_owner_pot.gold + d, updated_at = now()
    returning gold into pot;
  if d < 0 then insert into pvp_inv_owner_pot (player_id, gold) values (p_owner, -d) on conflict (player_id) do update set gold = pvp_inv_owner_pot.gold - d, updated_at = now(); end if;
  insert into pvp_inv_log (player_id, item, delta, why, ref, gold) values (tgt, 'gold', 0, case when d > 0 then 'admin_gold_give' else 'admin_gold_take' end, p_owner, d);
  return jsonb_build_object('ok', true, 'delta', d, 'pot', pot);
end $$;
revoke all on function public.pvp_admin_gold(text, text, integer) from public, anon, authenticated;

commit;
