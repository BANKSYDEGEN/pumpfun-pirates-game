-- pfp-v335 / BANKSY t1780u + t1783u + t1784u "rn in inventory can't give weapon items / like could give a fish":
-- GIVE TO A PIRATE works for every weapon (shop-bought 'carry_buy' copies + equipped ones) and gun attachments.
--   * pvp_inv_take_gift: like pvp_inv_take but may also take 'carry_buy' copies (non carry_buy first); returns how many came from
--     carry_buy so the receiver gets those AS 'carry_buy' again (still never market / salvage / chest-laundered gold buys).
--   * pvp_inv_gift(.., p_gid uuid default null): weapons go one copy at a time; a musket's pvp_gun_inst row (047) moves to the
--     receiver with its fitted attachments (acc); the giver's equipped slot is cleared when no copy is left.
-- Additive / replace-only. Safe to re-run.
begin;

create or replace function public.pvp_inv_take_gift(p_pid text, p_item text, p_qty integer, p_ref text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare r record; need integer := p_qty; have integer; k integer; cb integer := 0; lock_kit boolean := pvp_flag('test_only_lock');
begin
  if p_qty is null or p_qty < 1 then return null; end if;
  select coalesce(sum(qty), 0) into have from (select qty from pvp_inv where player_id = p_pid and item = p_item and not (lock_kit and source = 'kit') for update) s;
  if have < p_qty then return null; end if;
  for r in select source, qty from pvp_inv where player_id = p_pid and item = p_item and not (lock_kit and source = 'kit')
      order by case source when 'carry_buy' then 2 when 'kit' then 0 else 1 end, source loop
    exit when need = 0; k := least(need, r.qty);
    if k = r.qty then delete from pvp_inv where player_id = p_pid and item = p_item and source = r.source;
    else update pvp_inv set qty = qty - k, updated_at = now() where player_id = p_pid and item = p_item and source = r.source; end if;
    insert into pvp_inv_log (player_id, item, delta, source, why, ref) values (p_pid, p_item, -k, r.source, 'gift_out', p_ref);
    if r.source = 'carry_buy' then cb := cb + k; end if;
    need := need - k;
  end loop;
  return cb;
end $$;
revoke all on function public.pvp_inv_take_gift(text, text, integer, text) from public, anon, authenticated;

drop function if exists public.pvp_inv_gift(text, text, text, integer);
create or replace function public.pvp_inv_gift(p_from text, p_to text, p_item text, p_qty integer, p_gid uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a text := public.pvp_main(p_from); b text := public.pvp_main(p_to); mid uuid; cb integer; g uuid := null; left_n integer;
begin
  if not pvp_flag('gift') then return jsonb_build_object('ok', false, 'why', 'gifts closed'); end if;
  if b is null or b = a then return jsonb_build_object('ok', false, 'why', 'not to yourself'); end if;
  if not exists (select 1 from pvp_players where id = b) and not exists (select 1 from pvp_dev_profiles where id = b) and not exists (select 1 from pvp_profiles where id = b) and b <> pvp_inv_owner()
    then return jsonb_build_object('ok', false, 'why', 'no such pirate'); end if;
  if p_qty is null or p_qty < 1 or p_qty > 999 then return jsonb_build_object('ok', false, 'why', 'bad qty'); end if;
  if p_item like 'wpn:%' and p_qty <> 1 then return jsonb_build_object('ok', false, 'why', 'one weapon at a time'); end if;
  if not pvp_rl_hit('gift:' || a, 60, 6) or not pvp_rl_hit('giftd:' || a, 86400, 100) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  if p_item like 'map:%' then
    if p_qty <> 1 then return jsonb_build_object('ok', false, 'why', 'bad qty'); end if;
    mid := pvp_inv_map(a, p_item); if mid is null then return jsonb_build_object('ok', false, 'why', 'not enough'); end if;
    update pvp_maps set player_id = b, via = 'gift' where id = mid;
    insert into pvp_inv_log (player_id, item, delta, why, ref) values (a, p_item, -1, 'gift_out', b), (b, p_item, 1, 'gift_in', a);
  else
    cb := pvp_inv_take_gift(a, p_item, p_qty, b);
    if cb is null then return jsonb_build_object('ok', false, 'why', 'not enough'); end if;
    if cb > 0 then perform pvp_inv_add(b, p_item, cb, 'carry_buy', 'gift_in', a); end if;
    if p_qty - cb > 0 then perform pvp_inv_add(b, p_item, p_qty - cb, 'gift', 'gift_in', a); end if;
    if p_item like 'wpn:musket:%' then -- the musket copy travels with its fitted attachments
      select gid into g from pvp_gun_inst where player_id = a and item = p_item and place in ('bag', 'equip')
        order by (gid = p_gid) desc nulls last, case place when 'bag' then 0 else 1 end, updated_at limit 1;
      if g is not null then
        update pvp_gun_inst set player_id = b, place = 'bag', cottage_id = null, house_slot = null, updated_at = now() where gid = g;
      end if;
    end if;
  end if;
  select coalesce(sum(qty), 0) into left_n from pvp_inv where player_id = a and item = p_item;
  if p_item like 'wpn:%' and left_n = 0 then delete from pvp_inv_equip where player_id = a and item = p_item; end if;
  return jsonb_build_object('ok', true, 'to', b, 'item', p_item, 'qty', p_qty, 'left', left_n, 'gid', g);
end $$;
revoke all on function public.pvp_inv_gift(text, text, text, integer, uuid) from public, anon, authenticated;

commit;
