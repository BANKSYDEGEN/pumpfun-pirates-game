-- PUMPFUN PIRATES · migration 018 (v92) OWNER-ONLY one-off (BANKSY, game owner, asked Nov 1 2026: "make sure the gold on banksy combines").
-- The merged no-wallet BATTLE ROYALE account (pvp_alias group, migration 017) shares ONE server-side gold + upgrade save across
-- its devices. Only devices in pvp_alias (as alias or main) can use it; every other player is unchanged (device / wallet saves).
-- Combining: the FIRST sync from each device ADDS that device's local gold to the shared pot (and takes the max of each upgrade);
-- after that each device sends only its gold CHANGE since its last sync (delta), so both devices can play without overwriting.
-- Server-only: RLS on, no grants; only the `pvp` Edge Function (service role) calls pvp_group_sync.
create table if not exists public.pvp_group_saves (
  main       text primary key,
  gold       integer not null default 0 check (gold >= 0 and gold <= 10000000),
  upgrades   jsonb not null default '{}'::jsonb,
  devs       text[] not null default '{}',          -- devices whose local gold has been added once
  updated_at timestamptz not null default now()
);
alter table public.pvp_group_saves enable row level security;
revoke all on public.pvp_group_saves from public, anon, authenticated;

create or replace function public.pvp_group_sync(p_dev text, p_gold integer, p_delta integer, p_levels jsonb, p_gain_base integer, p_gain_per_min integer)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare m text; r pvp_group_saves; lv jsonb := '{}'::jsonb; k text; seeded boolean := false;
begin
  select a.main into m from pvp_alias a where a.dev = p_dev;
  if m is null and exists (select 1 from pvp_alias a where a.main = p_dev) then m := p_dev; end if;
  if m is null then return jsonb_build_object('ok', false, 'why', 'not a group'); end if;
  insert into pvp_group_saves (main) values (m) on conflict (main) do nothing;
  select * into r from pvp_group_saves where main = m for update;
  for k in select distinct x from (select jsonb_object_keys(r.upgrades) x union select jsonb_object_keys(coalesce(p_levels, '{}'::jsonb))) s loop
    lv := lv || jsonb_build_object(k, greatest(coalesce((r.upgrades->>k)::int, 0), least(8, greatest(0, coalesce((p_levels->>k)::int, 0)))));
  end loop;
  if not (p_dev = any(r.devs)) then  -- first sync from this device: add its local gold once
    r.gold := least(10000000, r.gold + greatest(0, least(coalesce(p_gold, 0), 10000000))); r.devs := r.devs || p_dev; seeded := true;
  else
    r.gold := least(10000000, greatest(0, r.gold + least(coalesce(p_delta, 0), greatest(0, p_gain_base + round(p_gain_per_min * least(60, extract(epoch from now() - r.updated_at) / 60))::int))));
  end if;
  update pvp_group_saves set gold = r.gold, upgrades = lv, devs = r.devs, updated_at = now() where main = m;
  return jsonb_build_object('ok', true, 'gold', r.gold, 'levels', lv, 'seeded', seeded, 'devices', coalesce(array_length(r.devs, 1), 0));
end $function$;
revoke all on function public.pvp_group_sync(text, integer, integer, jsonb, integer, integer) from public, anon, authenticated;
