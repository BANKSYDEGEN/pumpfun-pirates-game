-- Recover historical server-saved parrots and alias-owned receipts. No client ownership claims.
-- Transaction-local PRIVATE before-image backup is created BEFORE any inventory mutation.
begin;
create table if not exists public.pvp_parrot_legacy_backup_060 as
 select 'profile'::text as source, to_jsonb(p) as row from public.pvp_profiles p
 union all select 'dev_profile', to_jsonb(p) from public.pvp_dev_profiles p
 union all select 'owned', to_jsonb(p) from public.pvp_owned p
 union all select 'parrot', to_jsonb(p) from public.pvp_parrots p
 union all select 'inventory', to_jsonb(p) from public.pvp_inv p
 union all select 'equipped', to_jsonb(p) from public.pvp_parrot_equipped p;
alter table public.pvp_parrot_legacy_backup_060 enable row level security;
revoke all on public.pvp_parrot_legacy_backup_060 from public,anon,authenticated;
grant select on public.pvp_parrot_legacy_backup_060 to service_role;

create or replace function public.pvp_parrot_ensure(p_player text) returns void
language plpgsql security definer set search_path=public as $$
declare pid text:=pvp_main(p_player); r record; bid uuid; selected text; begin
 perform pg_advisory_xact_lock(hashtextextended('parrot:'||pid,0));
 -- The immutable snapshot preserves equipped pets that v412 previously overlooked.
 -- A profile-only seed is eligible only if there was no individual bird/escrow history.
 for r in
  select distinct item from (
   select o.item from pvp_owned o where pvp_main(o.player_id)=pid
   union
   select b.row->>'item' from pvp_parrot_legacy_backup_060 b
    where b.source='owned' and pvp_main(b.row->>'player_id')=pid
   union
   select 'gear:parrot:'||(b.row->'gear'->>'parrot') from pvp_parrot_legacy_backup_060 b
    where b.source in ('profile','dev_profile') and pvp_main(b.row->>'id')=pid
    and not exists (select 1 from pvp_parrot_legacy_backup_060 inv where inv.source='inventory'
      and pvp_main(inv.row->>'player_id')=pid and inv.row->>'item' like 'par:%')
    and not exists (select 1 from pvp_parrot_legacy_backup_060 eq where eq.source='equipped' and pvp_main(eq.row->>'player_id')=pid)
  ) candidates where item in ('gear:parrot:parrot_green','gear:parrot:parrot_red','gear:parrot:parrot_blue','gear:parrot:parrot_cockatoo','gear:parrot:parrot_black','gear:parrot:parrot_gold','gear:parrot:parrot_diamond')
 loop
  -- A consumed legacy entitlement stays consumed even if its bird was sold, gifted or escrowed.
  if exists(select 1 from pvp_parrots p where pvp_main(p.legacy_player)=pid and p.legacy_item=r.item) then continue; end if;
  bid:=null; selected:=substr(r.item,13);
  insert into pvp_parrots(color,xp,legacy_player,legacy_item)
   values(selected,case selected when 'parrot_red' then 100 when 'parrot_blue' then 400 when 'parrot_cockatoo' then 1600 when 'parrot_black' then 3600 when 'parrot_gold' then 6400 when 'parrot_diamond' then 10000 else 0 end,pid,r.item)
   on conflict(legacy_player,legacy_item) do nothing returning id into bid;
  if bid is not null then
   perform pvp_inv_add(pid,'par:'||bid,1,'carry_grant','parrot_legacy_recovery');
   if exists(select 1 from pvp_parrot_legacy_backup_060 b where b.source in ('profile','dev_profile') and pvp_main(b.row->>'id')=pid and b.row->'gear'->>'parrot'=selected) then
    insert into pvp_parrot_equipped values(pid,bid) on conflict(player_id) do nothing;
   end if;
  end if;
 end loop;
end $$;
revoke all on function public.pvp_parrot_ensure(text) from public,anon,authenticated;
grant execute on function public.pvp_parrot_ensure(text) to service_role;
-- Backfill every existing account, not only the next account that opens the cage.
do $$ declare p record; begin
 for p in select distinct pvp_main(row->>'id') as id from pvp_parrot_legacy_backup_060 where source in ('profile','dev_profile')
  union select distinct pvp_main(row->>'player_id') from pvp_parrot_legacy_backup_060 where source='owned'
 loop if p.id is not null then perform pvp_parrot_ensure(p.id); end if; end loop;
end $$;
commit;
