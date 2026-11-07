-- PUMPFUN PIRATES · migration 063: BANKSY t2150u (parrot treat said NOT ENOUGH GOLD with 26,000 shown).
-- The owner pot's gain allowance was measured from updated_at, which EVERY group_sync bumped, including delta-0 saves from the
-- second linked device. So one device's idle saves kept resetting the window and the other device's big pending gain was
-- rejected 'gold gained too fast' forever: the client showed it, the server pot (what treats/casino/houses spend) never got it.
-- Fix: only a real gain (or the first seed) restarts the window. Same caps, same function signature.
CREATE OR REPLACE FUNCTION public.pvp_group_sync(p_dev text, p_gold integer, p_delta integer, p_levels jsonb, p_gain_base integer, p_gain_per_min integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m text := pvp_main(p_dev); r pvp_group_saves; lv jsonb := '{}'::jsonb; k text; seeded boolean := false;
begin
  if not exists (select 1 from pvp_alias a where a.main = m) then return jsonb_build_object('ok', false, 'why', 'not a group'); end if;
  insert into pvp_group_saves (main) values (m) on conflict (main) do nothing;
  select * into r from pvp_group_saves where main = m for update;
  for k in select distinct x from (select jsonb_object_keys(r.upgrades) x union select jsonb_object_keys(coalesce(p_levels, '{}'::jsonb))) s loop
    lv := lv || jsonb_build_object(k, greatest(coalesce((r.upgrades->>k)::int, 0), least(8, greatest(0, coalesce((p_levels->>k)::int, 0)))));
  end loop;
  if not (p_dev = any(r.devs)) then  -- first sync from this device: add its local gold once
    r.gold := least(10000000, r.gold + greatest(0, least(coalesce(p_gold, 0), 10000000))); r.devs := r.devs || p_dev; seeded := true;
  else
    if coalesce(p_delta, 0) > p_gain_base + round(p_gain_per_min * least(60, extract(epoch from now() - r.updated_at) / 60))::int then
      return jsonb_build_object('ok', false, 'why', 'gold gained too fast');
    end if;
    r.gold := least(10000000, greatest(0, r.gold + coalesce(p_delta, 0)));
  end if;
  update pvp_group_saves set gold = r.gold, upgrades = lv, devs = r.devs, updated_at = case when seeded or coalesce(p_delta, 0) > 0 then now() else r.updated_at end where main = m;
  return jsonb_build_object('ok', true, 'gold', r.gold, 'levels', lv, 'seeded', seeded, 'devices', coalesce(array_length(r.devs, 1), 0));
end $function$
;
revoke all on function public.pvp_group_sync(text, integer, integer, jsonb, integer, integer) from public, anon, authenticated;
