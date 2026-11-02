-- PUMPFUN PIRATES · migration 022 (v102): THE ISLAND SHOP, server side (Timothy's 021 draft, renumbered: 021 = harbor copies).
-- ADDITIVE ONLY: new tables, new columns with defaults, inserts with ON CONFLICT DO NOTHING. No existing gold, score, kill,
-- leaderboard or player row is updated or deleted. Server-only like 005: RLS on, no policies, no anon / authenticated grants.
-- Backup before applying: /workspace/backups/shop/*_20261102_111850.json (box, not the repo).
begin;

-- 1) server copy of DEVICE saves (pirates without a wallet): the gold the shop spends. id = the kill board's 'dev:<hash>'.
--    Filled by the `pvp` function's dev_sync (same plausibility caps as wallet saves). gold = spendable, gold_pending = seed gold
--    above the seed cap, released into gold at the normal earning pace (never lost, only delayed).
create table if not exists public.pvp_dev_profiles (
  id           text primary key check (id ~ '^dev:[0-9a-f]{24}$'),
  gold         integer not null default 0 check (gold >= 0 and gold <= 10000000),
  gold_pending integer not null default 0 check (gold_pending >= 0 and gold_pending <= 10000000),
  upgrades     jsonb not null default '{}'::jsonb,
  skin         text not null default 'classic',
  gear         jsonb not null default '{}'::jsonb,
  kills        integer not null default 0 check (kills >= 0),
  deaths       integer not null default 0 check (deaths >= 0),
  bot_kills    integer not null default 0 check (bot_kills >= 0),
  harbor_kills integer not null default 0 check (harbor_kills >= 0),
  boss_kills   integer not null default 0 check (boss_kills >= 0),
  shop_rev     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- wallet profiles: shop revision (save reconciliation) + equipped gear (defaults: nothing changes for anyone)
alter table public.pvp_profiles add column if not exists shop_rev integer not null default 0;
alter table public.pvp_profiles add column if not exists gear jsonb not null default '{}'::jsonb;

-- 2) what each pirate owns. player_id = the RESOLVED id (pvp_main). item = 'skin:<id>' | 'gear:<slot>:<id>'.
create table if not exists public.pvp_owned (
  player_id  text not null,
  item       text not null check (item ~ '^(skin:[a-z0-9_]{2,24}|gear:[a-z]{2,10}:[a-z0-9_]{2,24})$'),
  source     text not null check (source in ('buy', 'legacy', 'legacy_commodore', 'grant')),
  price      integer not null default 0 check (price >= 0),
  uses_left  integer,
  created_at timestamptz not null default now(),
  primary key (player_id, item)
);
-- 3) append-only purchase ledger (audit, idempotent retries, save reconciliation by shop_rev)
create table if not exists public.pvp_purchases (
  id          bigserial primary key,
  player_id   text not null,
  req         text not null unique check (char_length(req) between 16 and 64),
  item        text not null,
  price       integer not null check (price >= 0),
  gold_before integer not null, gold_after integer not null,
  rev         integer not null,
  created_at  timestamptz not null default now()
);
create index if not exists pvp_purchases_player_idx on public.pvp_purchases (player_id, rev);
-- 4) ids the server knew before the shop shipped: only these may claim LEGACY skins from their device save at first sync
create table if not exists public.pvp_shop_legacy_ids (id text primary key, created_at timestamptz not null default now());
insert into public.pvp_shop_legacy_ids (id)
  select distinct public.pvp_main(x) from (select id as x from public.pvp_players union select player_id from public.pvp_net
    union select killer_id from public.pvp_kills union select victim_id from public.pvp_kills union select player_id from public.pvp_kill_claims
    union select player_id from public.pvp_airdrop) s where x like 'dev:%'
  on conflict do nothing;

alter table public.pvp_dev_profiles enable row level security;
alter table public.pvp_owned enable row level security;
alter table public.pvp_purchases enable row level security;
alter table public.pvp_shop_legacy_ids enable row level security;
revoke all on public.pvp_dev_profiles, public.pvp_owned, public.pvp_purchases, public.pvp_shop_legacy_ids from public, anon, authenticated;

-- 5) the buy: one transaction, row-locked gold. The Edge Function has already resolved the id, looked the price up in ITS OWN
--    catalog (lib.ts SHOP) and checked the goal against stored stats; the client's price is never used.
create or replace function public.pvp_shop_buy(p_player text, p_item text, p_price integer, p_req text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); g integer; rv integer; prev pvp_purchases; is_wallet boolean := pid like 'wallet:%';
begin
  if p_price is null or p_price < 0 or p_item is null or p_req is null then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
  select * into prev from pvp_purchases where req = p_req;
  if found then
    if prev.player_id <> pid then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
    return jsonb_build_object('ok', true, 'gold', prev.gold_after, 'rev', prev.rev, 'retry', true);
  end if;
  if pid = 'dev:e191a32e15abea4f14355121' then return jsonb_build_object('ok', true, 'owner', true); end if; -- owner: everything, free
  if exists (select 1 from pvp_owned where player_id = pid and item = p_item) then return jsonb_build_object('ok', false, 'why', 'already owned'); end if;
  if is_wallet then select gold, shop_rev into g, rv from pvp_profiles where id = pid for update;
  else select gold, shop_rev into g, rv from pvp_dev_profiles where id = pid for update; end if;
  if not found then return jsonb_build_object('ok', false, 'why', 'no save yet'); end if;
  if g < p_price then return jsonb_build_object('ok', false, 'why', 'not enough gold', 'gold', g); end if;
  rv := rv + 1;
  if is_wallet then update pvp_profiles set gold = g - p_price, shop_rev = rv where id = pid;
  else update pvp_dev_profiles set gold = g - p_price, shop_rev = rv where id = pid; end if;
  insert into pvp_owned (player_id, item, source, price) values (pid, p_item, 'buy', p_price);
  insert into pvp_purchases (player_id, req, item, price, gold_before, gold_after, rev) values (pid, p_req, p_item, p_price, g, g - p_price, rv);
  return jsonb_build_object('ok', true, 'gold', g - p_price, 'rev', rv);
end $$;
revoke all on function public.pvp_shop_buy(text, text, integer, text) from public, anon, authenticated;

-- 6) LEGACY at cutover: everyone keeps every BR skin they could use before the shop (kill tiers + the v98 COMMODORE unlock).
with tiers(id, need) as (values ('blood',10),('seagreen',25),('midnight',50),('coral',150),('storm',300),('kraken',600),('golden',1000),('ghost',1500),('admiral',2000),('flaming',2500),('diamond',5000))
insert into public.pvp_owned (player_id, item, source)
  select p.id, 'skin:' || t.id, 'legacy' from public.pvp_profiles p join tiers t on p.kills >= t.need
  on conflict do nothing;
insert into public.pvp_owned (player_id, item, source)
  select p.id, 'skin:commodore', 'legacy_commodore' from public.pvp_profiles p where p.boss_kills >= 100
  on conflict do nothing;
with tiers(id, need) as (values ('blood',10),('seagreen',25),('midnight',50),('coral',150),('storm',300),('kraken',600),('golden',1000),('ghost',1500),('admiral',2000),('flaming',2500),('diamond',5000)),
     k as (select public.pvp_main(killer_id) as pid, count(*) as n from public.pvp_kills where killer_id like 'dev:%' group by 1)
insert into public.pvp_owned (player_id, item, source)
  select k.pid, 'skin:' || t.id, 'legacy' from k join tiers t on k.n >= t.need
  on conflict do nothing;

commit;
-- ROLLBACK: drop nothing. Turn the shop off (SHOP_ENABLED in js/config.js); the old save path keeps working.
