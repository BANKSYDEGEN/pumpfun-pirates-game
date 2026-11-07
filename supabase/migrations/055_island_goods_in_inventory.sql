-- 055: island goods live in the REGULAR inventory (pvp_inv, source 'isl') -- BANKSY 2026-11-06 t1979u/t1980u "make them all same inventory".
-- isl:<id> keys are now inventory items: give / market / house storage / backpack cap all apply. pvp_isl_goods is retired
-- (renamed pvp_isl_goods_retired after its rows move over); the island RPCs read + write pvp_inv through pvp_inv_add / pvp_inv_take.
begin;
alter table public.pvp_inv drop constraint pvp_inv_item_check;
alter table public.pvp_inv add constraint pvp_inv_item_check check (item ~ '^(fish:[a-z_]{2,16}|val:[a-z_]{2,20}|wpn:(sword|musket):[a-z_]{2,16}:(common|rare|epic|legendary)|dup:[a-z]{2,10}:[a-z0-9_]{2,24}:(common|uncommon|rare|epic|legendary)|isl:[a-z_]{2,24})$');
alter table public.pvp_inv drop constraint pvp_inv_source_check;
alter table public.pvp_inv add constraint pvp_inv_source_check check (source = any (array['fish','chest','find','gift','market','kit','carry_buy','carry_grant','house','isl']));
do $$ declare r record; begin
  for r in select player_id, item, qty from public.pvp_isl_goods where qty > 0 loop
    perform public.pvp_inv_add(r.player_id, r.item, r.qty, 'isl', 'isl_move_055', null);
  end loop; end $$;
alter table public.pvp_isl_goods rename to pvp_isl_goods_retired;
CREATE OR REPLACE FUNCTION public.pvp_isl_give(p_pid text, p_src text, p_items jsonb, p_req text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare k text; v integer; tot integer := 0; used integer; cap integer := case p_src when 'crab' then 40 when 'dive' then 30 when 'mine' then 40 when 'plot' then 40 when 'still' then 16 else 0 end;
begin
  if exists (select 1 from pvp_isl_goods_log where req = p_req) then return jsonb_build_object('ok', true, 'retry', true); end if;
  for k, v in select key, (value)::int from jsonb_each_text(coalesce(p_items, '{}'::jsonb)) loop
    if v < 1 or v > 10 or not exists (select 1 from pvp_isl_items where item = k and src = p_src) then return jsonb_build_object('ok', false, 'why', 'bad item'); end if;
    tot := tot + v; end loop;
  if tot = 0 then return jsonb_build_object('ok', false, 'why', 'nothing'); end if;
  select coalesce(sum(qty), 0) into used from pvp_isl_goods_log where player_id = p_pid and src = p_src and day = pvp_isl_today();
  if used + tot > cap then return jsonb_build_object('ok', false, 'why', 'daily cap', 'cap', cap); end if;
  for k, v in select key, (value)::int from jsonb_each_text(p_items) loop
    perform public.pvp_inv_add(p_pid, k, v, 'isl', 'isl_' || p_src, p_req);   -- [055] the regular inventory (pvp_inv)
    insert into pvp_isl_goods_log (player_id, req, src, item, qty) values (p_pid, case when k = (select min(key) from jsonb_each_text(p_items)) then p_req else null end, p_src, k, v);
  end loop;
  return jsonb_build_object('ok', true, 'items', p_items);
end $function$;

CREATE OR REPLACE FUNCTION public.pvp_isl_goods_json(p_pid text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_object_agg(item, q), '{}'::jsonb) from (select item, sum(qty)::int q from pvp_inv where player_id = p_pid and item like 'isl:%' and source <> 'carry_buy' group by item having sum(qty) > 0) s $function$;

CREATE OR REPLACE FUNCTION public.pvp_isl_timer_start(p_player text, p_kind text, p_slot text, p_homegrown boolean, p_req text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pid text := public.pvp_main(p_player); mv jsonb := '{}'::jsonb; c integer; s integer;
begin
  if not pvp_flag('island_gold') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  perform public.pvp_isl_lock(pid);   -- [review fix 2] this pirate's lock FIRST: caps, one-time checks + balance below run under it
  if p_kind not in ('crab', 'plot', 'still') or p_slot is null or p_slot !~ '^[a-z0-9_]{2,24}$' then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
  if exists (select 1 from pvp_isl_timers where player_id = pid and kind = p_kind and slot = p_slot) then return jsonb_build_object('ok', false, 'why', 'already set'); end if;
  if p_kind = 'crab' and (select count(*) from pvp_isl_timers where player_id = pid and kind = 'crab') >= 3 then return jsonb_build_object('ok', false, 'why', 'three pots max'); end if;
  if p_kind in ('plot', 'still') and pid <> public.pvp_inv_owner() and not exists (select 1 from pvp_houses where player_id = pid and cottage_id = p_slot) then
    return jsonb_build_object('ok', false, 'why', 'buy this cottage first'); end if;
  if p_kind = 'still' then
    if coalesce(p_homegrown, false) then
      perform 1 from pvp_inv where player_id = pid and item in ('isl:island_cane', 'isl:island_spices') and source <> 'carry_buy' for update;
      select coalesce((select sum(qty) from pvp_inv where player_id = pid and item = 'isl:island_cane' and source <> 'carry_buy'), 0),
             coalesce((select sum(qty) from pvp_inv where player_id = pid and item = 'isl:island_spices' and source <> 'carry_buy'), 0) into c, s;
      if c < 2 or s < 1 then return jsonb_build_object('ok', false, 'why', 'need 2 cane + 1 spice'); end if;
      perform public.pvp_inv_take(pid, 'isl:island_cane', 2, 'still_brew', p_slot);   -- [055] regular inventory
      perform public.pvp_inv_take(pid, 'isl:island_spices', 1, 'still_brew', p_slot);
    else
      mv := public.pvp_isl_move(p_player, -25, p_req, 'rum_mash', p_slot);
      if not coalesce((mv->>'ok')::boolean, false) then return mv; end if;
    end if;
  end if;
  insert into pvp_isl_timers (player_id, kind, slot, meta) values (pid, p_kind, p_slot, jsonb_build_object('homegrown', coalesce(p_homegrown, false)));
  return mv || jsonb_build_object('ok', true, 'kind', p_kind, 'slot', p_slot, 'started_at', now(), 'goods', pvp_isl_goods_json(pid));
end $function$;

CREATE OR REPLACE FUNCTION public.pvp_isl_sell(p_player text, p_item text, p_qty integer, p_shop text, p_req text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pid text := public.pvp_main(p_player); pr integer; have integer; q integer := coalesce(p_qty, 0); mv jsonb;
begin
  if not pvp_flag('island_gold') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  perform public.pvp_isl_lock(pid);   -- [review fix 2] this pirate's lock FIRST: caps, one-time checks + balance below run under it
  if q < 1 or q > 999 then return jsonb_build_object('ok', false, 'why', 'bad qty'); end if;
  select price into pr from pvp_isl_prices where item = p_item and shop = p_shop;
  if pr is null then return jsonb_build_object('ok', false, 'why', 'this shop does not buy that'); end if;
  mv := public.pvp_isl_replay(pid, p_req, 'sell', p_item, pr * q);   -- [review fix 1] same item + same total, else rejected
  if mv is not null then return mv || jsonb_build_object('goods', pvp_isl_goods_json(pid)); end if;
  select coalesce(sum(qty), 0) into have from (select qty from pvp_inv where player_id = pid and item = p_item and source <> 'carry_buy' for update) h;   -- [055] regular inventory
  if coalesce(have, 0) < q then return jsonb_build_object('ok', false, 'why', 'not enough', 'have', coalesce(have, 0)); end if;
  mv := public.pvp_isl_move(p_player, pr * q, p_req, 'sell', p_item);
  if not coalesce((mv->>'ok')::boolean, false) then return mv; end if;
  perform public.pvp_inv_take(pid, p_item, q, 'sell:' || p_shop, p_req);
  return mv || jsonb_build_object('sold', q, 'item', p_item, 'price', pr, 'goods', pvp_isl_goods_json(pid));
end $function$;

commit;
