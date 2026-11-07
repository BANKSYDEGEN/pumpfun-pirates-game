-- BANKSY: base parrots only; individual, upgradeable marketplace inventory pets.
-- Backup before applying. Legacy ownership is retained, converted once, never re-granted after trade.
begin;
create table public.pvp_parrots (
 id uuid primary key default gen_random_uuid(),
 name text check (name is null or char_length(name) between 1 and 16),
 xp integer not null default 0 check (xp between 0 and 10000),
 color text not null default 'parrot_green' check (color in ('parrot_green','parrot_red','parrot_blue','parrot_cockatoo','parrot_black','parrot_gold','parrot_diamond')),
 legacy_player text, legacy_item text, created_at timestamptz not null default now(),
 unique(legacy_player, legacy_item)
);
create table public.pvp_parrot_equipped (player_id text primary key, id uuid not null references public.pvp_parrots(id));
alter table public.pvp_parrots enable row level security;
alter table public.pvp_parrot_equipped enable row level security;
revoke all on public.pvp_parrots, public.pvp_parrot_equipped from public, anon, authenticated;
grant all on public.pvp_parrots, public.pvp_parrot_equipped to service_role;
alter table public.pvp_inv drop constraint pvp_inv_item_check;
alter table public.pvp_inv add constraint pvp_inv_item_check check (item ~ '^(fish:[a-z_]{2,16}|val:[a-z_]{2,20}|wpn:(sword|musket):[a-z_]{2,16}:(common|rare|epic|legendary)|dup:[a-z]{2,10}:[a-z0-9_]{2,24}:(common|uncommon|rare|epic|legendary)|isl:[a-z_]{2,24}|par:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$');
alter table public.pvp_inv add constraint pvp_parrot_qty check (item not like 'par:%' or qty = 1);
create unique index pvp_parrot_one_holder on public.pvp_inv(item) where item like 'par:%';
create or replace function public.pvp_parrot_unlock(p_xp integer) returns text[] language sql immutable as $$
 select (array['parrot_green','parrot_red','parrot_blue','parrot_cockatoo','parrot_black','parrot_gold','parrot_diamond'])[1:case when pvp_pet_lv(p_xp)>=10 then 7 when pvp_pet_lv(p_xp)>=8 then 6 when pvp_pet_lv(p_xp)>=6 then 5 when pvp_pet_lv(p_xp)>=4 then 4 when pvp_pet_lv(p_xp)>=2 then 3 when pvp_pet_lv(p_xp)>=1 then 2 else 1 end] $$;
create or replace function public.pvp_parrot_ensure(p_player text) returns void language plpgsql security definer set search_path=public as $$
declare pid text:=pvp_main(p_player); r record; bid uuid; begin
 perform pg_advisory_xact_lock(hashtextextended('parrot:'||pid,0));
 for r in select item from pvp_owned where player_id=pid and item in ('gear:parrot:parrot_green','gear:parrot:parrot_red','gear:parrot:parrot_blue','gear:parrot:parrot_cockatoo','gear:parrot:parrot_black','gear:parrot:parrot_gold','gear:parrot:parrot_diamond') loop
  bid:=null;
  insert into pvp_parrots(color,xp,legacy_player,legacy_item) values(substr(r.item,13),case substr(r.item,13) when 'parrot_red' then 100 when 'parrot_blue' then 400 when 'parrot_cockatoo' then 1600 when 'parrot_black' then 3600 when 'parrot_gold' then 6400 when 'parrot_diamond' then 10000 else 0 end,pid,r.item)
   on conflict(legacy_player,legacy_item) do nothing returning id into bid;
  if bid is not null then
   perform pvp_inv_add(pid,'par:'||bid,1,'carry_grant','parrot_legacy');
   if exists(select 1 from pvp_profiles where id=pid and gear->>'parrot'=substr(r.item,13)) or exists(select 1 from pvp_dev_profiles where id=pid and gear->>'parrot'=substr(r.item,13)) then
    insert into pvp_parrot_equipped values(pid,bid) on conflict(player_id) do nothing;
   end if;
  end if;
 end loop;
end $$;
-- Removing a bird for a listing/gift also unequips it in the SAME transaction.
create or replace function public.pvp_parrot_removed() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.item like 'par:%' then
  delete from pvp_parrot_equipped where player_id=old.player_id and id=substr(old.item,5)::uuid;
  if found then
   update pvp_profiles set gear=jsonb_set(coalesce(gear,'{}'),'{parrot}','"none"'),shop_rev=coalesce(shop_rev,0)+1 where id=old.player_id;
   update pvp_dev_profiles set gear=jsonb_set(coalesce(gear,'{}'),'{parrot}','"none"'),shop_rev=coalesce(shop_rev,0)+1 where id=old.player_id;
  end if;
 end if;
 return old;
end $$;
create trigger pvp_parrot_removed after delete on public.pvp_inv for each row execute function public.pvp_parrot_removed();
create or replace function public.pvp_parrot_buy(p_player text,p_req text) returns jsonb language plpgsql security definer set search_path=public as $$
declare pid text:=pvp_main(p_player); bid uuid; g integer; prev pvp_purchases; cost integer:=2000; begin
 perform pg_advisory_xact_lock(hashtextextended('parrot:'||pid,0));
 if p_req !~ '^[A-Za-z0-9_-]{16,64}$' then return jsonb_build_object('ok',false,'why','bad request'); end if;
 select * into prev from pvp_purchases where req=p_req;
 if found then
  if prev.player_id<>pid or prev.item<>'gear:parrot:parrot_green' then return jsonb_build_object('ok',false,'why','bad request'); end if;
  return jsonb_build_object('ok',true,'retry',true,'gold',prev.gold_after,'rev',prev.rev,'price',0);
 end if;
 if not pvp_rl_hit('parbuy:'||pid,60,6) then return jsonb_build_object('ok',false,'why','slow down'); end if;
 perform pvp_parrot_ensure(pid);
 if pid=pvp_inv_owner() then cost:=0; end if;
 g:=pvp_pet_gold(pid,-cost);
 if g is null then return jsonb_build_object('ok',false,'why','not enough gold'); end if;
 insert into pvp_parrots default values returning id into bid;
 perform pvp_inv_add(pid,'par:'||bid,1,'carry_grant','parrot_buy',p_req);
 insert into pvp_purchases(player_id,req,item,price,gold_before,gold_after,rev) values(pid,p_req,'gear:parrot:parrot_green',cost,g+cost,g,pvp_pet_rev(pid));
 return jsonb_build_object('ok',true,'id',bid,'gold',g,'rev',pvp_pet_rev(pid),'price',cost,'owner',pid=pvp_inv_owner());
end $$;
create or replace function public.pvp_parrot_op(p_player text,p_op text,p_id uuid default null,p_name text default null,p_color text default null) returns jsonb language plpgsql security definer set search_path=public as $$
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
  update pvp_parrots set xp=least(10000,xp+5) where id=p_id;
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
end $$;
revoke all on function public.pvp_parrot_ensure(text), public.pvp_parrot_op(text,text,uuid,text,text), public.pvp_parrot_buy(text,text), public.pvp_parrot_removed() from public,anon,authenticated;
grant execute on function public.pvp_parrot_ensure(text), public.pvp_parrot_op(text,text,uuid,text,text), public.pvp_parrot_buy(text,text) to service_role;
-- Guard retired pets at the database boundary too, including stale clients.
alter function public.pvp_shop_buy(text,text,integer,text) rename to pvp_shop_buy_pre_parrots;
create or replace function public.pvp_shop_buy(p_player text,p_item text,p_price integer,p_req text) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if p_item='gear:parrot:parrot_green' then return pvp_parrot_buy(p_player,p_req); end if;
 if p_item like 'gear:parrot:%' then return jsonb_build_object('ok',false,'why','not for sale'); end if;
 return pvp_shop_buy_pre_parrots(p_player,p_item,p_price,p_req);
end $$;
revoke all on function public.pvp_shop_buy(text,text,integer,text) from public,anon,authenticated;
grant execute on function public.pvp_shop_buy(text,text,integer,text) to service_role;
notify pgrst, 'reload schema';
commit;
