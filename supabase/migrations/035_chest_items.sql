-- PUMPFUN PIRATES · migration 035 (v197; written as 031 on v152, renumbered: 031 = prestige): CHEST ITEMS (BANKSY: "add accessories weapons clothes for character or crew as options
-- for treasure hunt chests"). ADDITIVE ONLY: one new table + one new function. Nothing existing is altered, dropped or rewritten:
-- pvp_maps / pvp_map_dig (026) stay exactly as they are (the new function CALLS pvp_map_dig, so the dig rules + gold are unchanged),
-- no leaderboard, score, kill, gold or player row changes except what a dig itself grants:
--   * the dig gold (026, as today)
--   * the chest ITEM the Edge Function picked (supabase/functions/pvp/chest.ts, server-side, from the map id) -> pvp_owned
--     (source 'grant', price 0; the 022 check constraint already allows 'grant' + 'gear:<slot>:<id>')
--   * OR, when that item is already owned, its duplicate gold (half the shop price, x2 holder) credited like the dig gold.
-- Old Edge Function + this migration = nothing changes (it still calls pvp_map_dig). New Edge Function without this migration =
-- it falls back to pvp_map_dig (gold only). Safe in either deploy order.
begin;
create table if not exists public.pvp_map_loot (      -- one row per chest that held an item (audit + MAPS "last finds")
  map_id     uuid primary key references public.pvp_maps(id),
  player_id  text not null,
  item       text not null check (item ~ '^gear:[a-z]{2,10}:[a-z0-9_]{2,24}$'),
  crew       boolean not null default false,
  dup        boolean not null default false,          -- already owned -> paid dup_gold instead
  dup_gold   integer not null default 0 check (dup_gold between 0 and 100000),
  created_at timestamptz not null default now()
);
create index if not exists pvp_map_loot_player_idx on public.pvp_map_loot (player_id, created_at desc);
alter table public.pvp_map_loot enable row level security;
revoke all on public.pvp_map_loot from public, anon, authenticated;

-- dig + chest item in ONE transaction. p_item = null -> exactly pvp_map_dig. p_dup = the duplicate gold BEFORE the holder x2.
create or replace function public.pvp_map_dig_item(p_player text, p_map uuid, p_spot text, p_holder boolean, p_item text, p_crew boolean, p_dup integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); r jsonb; n integer := 0; dg integer := 0;
begin
  r := public.pvp_map_dig(p_player, p_map, p_spot, p_holder);         -- every 026 rule (owner, spot, 30 s, 20 s, 25 a day) + the gold
  if not coalesce((r->>'ok')::boolean, false) or p_item is null or pid = 'dev:e191a32e15abea4f14355121' then return r; end if;
  if p_item !~ '^gear:[a-z]{2,10}:[a-z0-9_]{2,24}$' then return r; end if;
  insert into pvp_owned (player_id, item, source, price) values (pid, p_item, 'grant', 0) on conflict (player_id, item) do nothing;
  get diagnostics n = row_count;
  if n = 0 then                                                         -- already owned: its gold instead
    dg := least(100000, greatest(0, coalesce(p_dup, 0))) * case when p_holder then 2 else 1 end;
    if dg > 0 then
      if pid like 'wallet:%' then update pvp_profiles set gold = least(10000000, gold + dg) where id = pid;
      else update pvp_dev_profiles set gold = least(10000000, gold + dg) where id = pid; end if;
    end if;
  end if;
  insert into pvp_map_loot (map_id, player_id, item, crew, dup, dup_gold) values (p_map, pid, p_item, coalesce(p_crew, false), n = 0, dg)
    on conflict (map_id) do nothing;
  return r || jsonb_build_object('item', p_item, 'crew', coalesce(p_crew, false), 'dup', n = 0, 'dup_gold', dg,
                                 'dig_gold', (r->>'gold')::integer, 'gold', (r->>'gold')::integer + dg);
end $$;
revoke all on function public.pvp_map_dig_item(text, uuid, text, boolean, text, boolean, integer) from public, anon, authenticated;
commit;
