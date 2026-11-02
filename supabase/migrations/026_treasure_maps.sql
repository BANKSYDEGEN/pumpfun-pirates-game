-- PUMPFUN PIRATES · migration 026 (v105): TREASURE MAPS (BANKSY: "when they have maps they can use them on island to track down
-- location and dig"). ADDITIVE ONLY: two new tables + two functions. No existing gold, kill, score, board or player row changes
-- except the gold a dig pays (credited like every other reward).
--   DROPS (server-decided, never claimed by the client):
--     common    one per harbor BOSS kill (the save's boss_kills going up, already plausibility-capped by save / dev_sync), max 15 a day
--     rare      4% per CONFIRMED Battle Royale kill (pvp_kills, both sides agreed), rolled from the kill id (no re-rolls)
--     legendary 20% when a kill is your 3rd confirmed kill in one life in one arena room (a 'win streak': the server has no
--               round-win record yet), rolled from the kill id
--   DIG: one per map, at the map's spot, >= 30 s after the drop, >= 20 s between digs, max 25 a day, reward rolled from the map id:
--     common 600-1,200 · rare 5,000-8,000 · legendary 15,000-25,000 gold (x2 holder / owner, like every earned gold)
begin;
create table if not exists public.pvp_maps (
  id         uuid primary key default gen_random_uuid(),
  player_id  text not null,
  tier       text not null check (tier in ('common', 'rare', 'legendary')),
  spot       text not null check (spot ~ '^[a-z0-9_]{2,16}$'),
  source     text not null check (source in ('boss', 'kill', 'streak')),
  source_ref text not null unique,                 -- 'boss:<player>:<n>' / 'kill:<pvp_kills.id>' / 'streak:<pvp_kills.id>': one map per source
  created_at timestamptz not null default now(),
  dug_at     timestamptz,
  gold       integer check (gold is null or gold between 0 and 60000),
  holder     boolean
);
create index if not exists pvp_maps_player_idx on public.pvp_maps (player_id, created_at desc);
create table if not exists public.pvp_map_state (     -- how far the drop scan has read for a pirate
  player_id  text primary key,
  boss_seen  integer not null default 0,
  kill_seen  bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.pvp_maps enable row level security;
alter table public.pvp_map_state enable row level security;
revoke all on public.pvp_maps, public.pvp_map_state from public, anon, authenticated;

-- deterministic roll 0..999 from a text seed
create or replace function public.pvp_map_roll(seed text) returns integer language sql immutable as $$
  select (('x' || substr(md5(seed || ':pfp-map-v1'), 1, 8))::bit(32)::bigint % 1000)::integer $$;
revoke all on function public.pvp_map_roll(text) from public, anon, authenticated;

-- scan for new drops. p_boss = the save's current boss_kills (the Edge Function reads it from the stored save).
create or replace function public.pvp_maps_sync(p_player text, p_boss integer, p_spots text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); st pvp_map_state; k record; n integer; today integer; made integer := 0; seq integer; sp text;
begin
  insert into pvp_map_state (player_id, boss_seen, kill_seen)
    values (pid, greatest(0, p_boss), coalesce((select max(id) from pvp_kills where killer_id = pid), 0))
    on conflict (player_id) do nothing;              -- first time: start from NOW (no retroactive maps)
  select * into st from pvp_map_state where player_id = pid for update;
  -- boss maps
  select count(*) into today from pvp_maps where player_id = pid and source = 'boss' and created_at > now() - interval '24 hours';
  n := least(greatest(0, p_boss - st.boss_seen), 5, greatest(0, 15 - today));
  for i in 1..n loop
    seq := st.boss_seen + i; sp := p_spots[1 + pvp_map_roll('boss:' || pid || ':' || seq) % array_length(p_spots, 1)];
    insert into pvp_maps (player_id, tier, spot, source, source_ref) values (pid, 'common', sp, 'boss', 'boss:' || pid || ':' || seq) on conflict (source_ref) do nothing;
    made := made + 1;
  end loop;
  if p_boss > st.boss_seen then update pvp_map_state set boss_seen = p_boss where player_id = pid; end if; -- over the cap: those drops are lost
  -- confirmed BR kills since the last scan
  for k in select id, room, life, (select count(*) from pvp_kills q where q.killer_id = pid and q.room = p.room and q.life = p.life and q.id <= p.id) as nth
           from pvp_kills p where killer_id = pid and id > st.kill_seen order by id limit 200 loop
    if k.nth = 3 and pvp_map_roll('streak:' || k.id) < 200 then
      insert into pvp_maps (player_id, tier, spot, source, source_ref) values (pid, 'legendary', 'cave', 'streak', 'streak:' || k.id) on conflict (source_ref) do nothing; made := made + 1;
    elsif pvp_map_roll('kill:' || k.id) < 40 then
      sp := p_spots[1 + pvp_map_roll('spot:' || k.id) % array_length(p_spots, 1)];
      insert into pvp_maps (player_id, tier, spot, source, source_ref) values (pid, 'rare', sp, 'kill', 'kill:' || k.id) on conflict (source_ref) do nothing; made := made + 1;
    end if;
    update pvp_map_state set kill_seen = k.id, updated_at = now() where player_id = pid;
  end loop;
  return jsonb_build_object('ok', true, 'new', made);
end $$;
revoke all on function public.pvp_maps_sync(text, integer, text[]) from public, anon, authenticated;

-- dig: one claim per map, at its spot, rate-limited; credits the server copy (device / wallet; the owner group syncs its own pot)
create or replace function public.pvp_map_dig(p_player text, p_map uuid, p_spot text, p_holder boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); m pvp_maps; last timestamptz; today integer; base integer; g integer;
begin
  select * into m from pvp_maps where id = p_map for update;
  if not found or m.player_id <> pid then return jsonb_build_object('ok', false, 'why', 'not your map'); end if;
  if m.dug_at is not null then return jsonb_build_object('ok', false, 'why', 'already dug'); end if;
  if m.spot <> p_spot then return jsonb_build_object('ok', false, 'why', 'wrong spot'); end if;
  if m.created_at > now() - interval '30 seconds' then return jsonb_build_object('ok', false, 'why', 'too soon'); end if;
  select max(dug_at), count(*) filter (where dug_at > now() - interval '24 hours') into last, today from pvp_maps where player_id = pid and dug_at is not null;
  if last is not null and last > now() - interval '20 seconds' then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  if today >= 25 then return jsonb_build_object('ok', false, 'why', 'daily dig limit'); end if;
  base := case m.tier when 'common' then 600 + pvp_map_roll('gold:' || m.id) * 601 / 1000
                      when 'rare' then 5000 + pvp_map_roll('gold:' || m.id) * 3001 / 1000
                      else 15000 + pvp_map_roll('gold:' || m.id) * 10001 / 1000 end;
  g := case when p_holder then base * 2 else base end;
  update pvp_maps set dug_at = now(), gold = g, holder = p_holder where id = m.id;
  if pid like 'wallet:%' then update pvp_profiles set gold = least(10000000, gold + g) where id = pid;
  elsif pid <> 'dev:e191a32e15abea4f14355121' then update pvp_dev_profiles set gold = least(10000000, gold + g) where id = pid; end if;
  return jsonb_build_object('ok', true, 'gold', g, 'base', base, 'tier', m.tier);
end $$;
revoke all on function public.pvp_map_dig(text, uuid, text, boolean) from public, anon, authenticated;
commit;
