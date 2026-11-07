-- [admin-spawn t2149u] BANKSY's ITEM SPAWNER (js/adminMenu.js + js/adminSpawn.js): the owner-only pvp_admin_pocket_give (045) also takes
-- island goods (isl:*) and levelled musket keys (LV 2-20, 061), so the owner can spawn ANY item and max a musket to LV 20.
-- Still owner-only (pvp_inv_owner() check, revoked from public/anon/authenticated, called only by the pvp function after whoAmI().owner).
-- Qty cap stays 99. No rows touched; one function replaced. Backup before applying: tools/inventory/backup_036.sh.
begin;
create or replace function public.pvp_admin_pocket_give(p_owner text, p_target text, p_item text, p_qty integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tgt text := public.pvp_main(p_target); q integer := greatest(1, least(coalesce(p_qty, 1), 99));
begin
  if p_owner is distinct from pvp_inv_owner() then return jsonb_build_object('ok', false, 'why', 'owner only'); end if;
  if tgt is null then return jsonb_build_object('ok', false, 'why', 'bad target'); end if;
  if p_item is null or p_item !~ '^(fish:[a-z_]{2,16}|val:[a-z_]{2,20}|wpn:(sword|musket):[a-z_]{2,16}:(common|rare|epic|legendary)|wpn:musket:[a-z_]{2,16}:(common:[2-5]|rare:([7-9]|10)|epic:1[2-5]|legendary:(1[7-9]|20))|dup:[a-z]{2,10}:[a-z0-9_]{2,24}:(common|uncommon|rare|epic|legendary)|isl:[a-z_]{2,24})$' then
    return jsonb_build_object('ok', false, 'why', 'bad item'); end if;
  if p_item like 'wpn:musket:%' and pvp_musk_lv(p_item) is null then return jsonb_build_object('ok', false, 'why', 'bad item'); end if;
  if p_item like 'wpn:%' then q := 1; end if;
  perform pvp_inv_add(tgt, p_item, q, 'gift', 'admin_give', p_owner);
  return jsonb_build_object('ok', true, 'item', p_item, 'qty', q, 'have', (select coalesce(sum(qty), 0) from pvp_inv where player_id = tgt and item = p_item));
end $$;
revoke all on function public.pvp_admin_pocket_give(text, text, text, integer) from public, anon, authenticated;
commit;
