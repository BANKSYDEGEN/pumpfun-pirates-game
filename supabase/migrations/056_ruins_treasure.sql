-- [ruins] BANKSY t1995u-t1997u (2026-11-07): jungle ruin chests drop valuables (sold at the Treasure Trader); Idol Shards respawn daily, still sell
-- at the Trader, and 21 of them (3+ days of shards) become a Golden Idol (20000 at the Trader, BANKSY t1999u) at the Skull Cave altar.
begin;
insert into public.pvp_inv_prices (item, shop, price) values
  ('val:golden_idol','antiques',20000)
on conflict (item, shop) do update set price = excluded.price;
-- island finds: shards / pearls as before, plus the ruin chests' common-table valuables (the Edge Function rolls which one); once per spot per day
create or replace function public.pvp_inv_find(p_player text, p_item text, p_spot text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); n integer;
begin
  if p_spot !~ '^[a-z0-9_]{2,32}$' then return jsonb_build_object('ok', false, 'why', 'bad find'); end if;
  if not (p_item in ('val:idol_shard', 'val:river_pearl') or (p_spot in ('jungle_ruin_chest', 'j_moss', 'j_idol', 'j_ledge') and p_item in ('val:silver_ring', 'val:gold_bar', 'val:pearl_necklace', 'val:ruby'))) then
    return jsonb_build_object('ok', false, 'why', 'bad find'); end if;
  insert into pvp_inv_once (player_id, k) values (pid, 'find:' || p_spot || ':' || current_date) on conflict do nothing; get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'why', 'found today'); end if;
  perform pvp_inv_add(pid, p_item, 1, case when p_spot like 'j%' and p_item <> 'val:idol_shard' then 'chest' else 'find' end, 'find', p_spot); return jsonb_build_object('ok', true, 'item', p_item);
end $$;
-- the Skull Cave altar: take p_need earned Idol Shards (row-locked in pvp_inv_take), give one Golden Idol
create or replace function public.pvp_inv_idol_forge(p_player text, p_need integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); have integer; lock_kit boolean := pvp_flag('test_only_lock');
begin
  if p_need is null or p_need < 21 then return jsonb_build_object('ok', false, 'why', 'bad need'); end if;
  if public.pvp_inv_take(pid, 'val:idol_shard', p_need, 'idol_forge') is null then
    select coalesce(sum(qty), 0) into have from pvp_inv where player_id = pid and item = 'val:idol_shard' and source <> 'carry_buy' and not (lock_kit and source = 'kit');
    return jsonb_build_object('ok', false, 'why', 'need shards', 'need', p_need, 'have', have); end if;
  perform pvp_inv_add(pid, 'val:golden_idol', 1, 'find', 'idol_forge'); return jsonb_build_object('ok', true, 'item', 'val:golden_idol');
end $$;
revoke all on function public.pvp_inv_find(text, text, text), public.pvp_inv_idol_forge(text, integer) from public, anon, authenticated;
commit;
