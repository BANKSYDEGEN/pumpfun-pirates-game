-- [BANKSY t2159u] parrot walk XP: 1 per minute (was 5). Treats unchanged (+100).
begin;
CREATE OR REPLACE FUNCTION public.pvp_parrot_op(p_player text, p_op text, p_id uuid DEFAULT NULL::uuid, p_name text DEFAULT NULL::text, p_color text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pid text:=pvp_main(p_player); r pvp_parrots; x integer; cost integer; g integer; eq uuid; begin
 perform pvp_parrot_ensure(pid);
 select e.id into eq from pvp_parrot_equipped e join pvp_inv i on i.player_id=pid and i.item='par:'||e.id where e.player_id=pid;
 if p_op='list' then
  return jsonb_build_object('ok',true,'equipped',eq,'parrots',coalesce((select jsonb_agg((to_jsonb(p)-'legacy_player'-'legacy_item')||jsonb_build_object('lv',pvp_pet_lv(p.xp),'colors',pvp_parrot_unlock(p.xp)) order by p.created_at) from pvp_parrots p join pvp_inv i on i.item='par:'||p.id and i.player_id=pid),'[]'::jsonb));
 end if;
 if p_op='walk' then p_id:=eq; end if;
 -- Lock possession before metadata; a concurrent marketplace take cannot also spend the bird.
 perform 1 from pvp_inv where player_id=pid and item='par:'||p_id for update;
 if not found then return jsonb_build_object('ok',false,'why','not your parrot'); end if;
 select * into r from pvp_parrots where id=p_id for update;
 if p_op='name' then
  if p_name is not null and char_length(p_name)>16 then return jsonb_build_object('ok',false,'why','name too long'); end if;
  update pvp_parrots set name=nullif(p_name,'') where id=p_id;
 elsif p_op='treat' then
  if r.xp>=10000 then return jsonb_build_object('ok',false,'why','max level'); end if;
  cost:=250*(pvp_pet_lv(r.xp)+1)^2;
  g:=pvp_pet_gold(pid,-cost); if g is null then return jsonb_build_object('ok',false,'why','not enough gold'); end if;
  update pvp_parrots set xp=least(10000,xp+100) where id=p_id;
 elsif p_op='walk' then
  if not pvp_rl_hit('parwalk:'||pid,55,1) then return jsonb_build_object('ok',false,'why','slow down'); end if;
  update pvp_parrots set xp=least(10000,xp+1) where id=p_id;
 elsif p_op in ('color','equip') then
  if p_op='color' then
   if not coalesce(p_color=any(pvp_parrot_unlock(r.xp)),false) then return jsonb_build_object('ok',false,'why','color locked'); end if;
   update pvp_parrots set color=p_color where id=p_id; r.color:=p_color;
  end if;
  insert into pvp_parrot_equipped values(pid,p_id) on conflict(player_id) do update set id=excluded.id;
  update pvp_profiles set gear=jsonb_set(coalesce(gear,'{}'),'{parrot}',to_jsonb(r.color)),shop_rev=coalesce(shop_rev,0)+1 where id=pid;
  update pvp_dev_profiles set gear=jsonb_set(coalesce(gear,'{}'),'{parrot}',to_jsonb(r.color)),shop_rev=coalesce(shop_rev,0)+1 where id=pid;
 else return jsonb_build_object('ok',false,'why','bad operation'); end if;
 select * into r from pvp_parrots where id=p_id;
 return jsonb_build_object('ok',true,'id',p_id,'color',r.color,'xp',r.xp,'lv',pvp_pet_lv(r.xp),'gold',g,'cost',cost,'rev',pvp_pet_rev(pid),'owner',pid=pvp_inv_owner());
end $function$;
commit;
