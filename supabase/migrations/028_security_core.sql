-- PUMPFUN PIRATES · migration 028 (security fixes, SECURITY_FIXES.md H2 / H4 / H1-prep / M2). APPLIED to production 2026-11-02.
-- Apply FIRST (before the `pvp` function and the client). ADDITIVE except two things, both reversible (see ROLLBACK at the end):
--   * pvp_claim_kill is replaced (same signature): a kill only counts when both pirates were seated in that match by the lobby
--     (pvp_match_seats, filled by the new `ticket` action) + anti-farming rules. Kills from clients older than this release stop
--     counting until they reload (they never ask for a ticket). Nothing already on the board changes.
--   * pvp_lobby / pvp_harbor become rate-limited wrappers around the unchanged functions (renamed *_core).
-- No existing row is updated or deleted. No leaderboard / player data changes.
begin;

-- ---------- H4: nonces carry what they were issued for; airdrop wallets remember whether a signature proved them ----------
alter table public.pvp_nonces add column if not exists purpose text not null default 'signin';
alter table public.pvp_nonces add column if not exists player_id text;
alter table public.pvp_airdrop add column if not exists verified boolean not null default false;
alter table public.pvp_airdrop add column if not exists verified_at timestamptz;

-- ---------- H1: one leaderboard row per server-noted Waves run ----------
alter table public.pvp_waves_runs add column if not exists scored_at timestamptz;

-- ---------- H2: identity age + who the lobby seated in which match ----------
create table if not exists public.pvp_identities (
  player_id  text primary key,
  first_seen timestamptz not null default now()
);
create table if not exists public.pvp_match_seats (   -- one row per (claim room, network id): written only by the `ticket` action
  room      text not null check (char_length(room) between 3 and 60),
  net       text not null check (net ~ '^[a-z0-9]{6,20}$'),
  player_id text not null,
  ip_hash   text not null,
  at        timestamptz not null default now(),
  primary key (room, net)
);
create index if not exists pvp_match_seats_player_idx on public.pvp_match_seats (player_id, at desc);
create index if not exists pvp_match_seats_ip_idx on public.pvp_match_seats (ip_hash, at desc);

-- ---------- M2: fixed-window rate limit counters ----------
create table if not exists public.pvp_rl (
  k text not null, w timestamptz not null, n integer not null default 0,
  primary key (k, w)
);
alter table public.pvp_identities enable row level security;
alter table public.pvp_match_seats enable row level security;
alter table public.pvp_rl enable row level security;
revoke all on public.pvp_identities, public.pvp_match_seats, public.pvp_rl from public, anon, authenticated;

-- true = under the limit (and counted). One row per key per window; old windows are swept now and then.
create or replace function public.pvp_rl_hit(p_key text, p_window_s integer, p_max integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare win timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_s) * p_window_s); c integer;
begin
  insert into pvp_rl (k, w, n) values (p_key, win, 1) on conflict (k, w) do update set n = pvp_rl.n + 1 returning n into c;
  if random() < 0.002 then delete from pvp_rl where w < now() - interval '2 hours'; end if;
  return c <= p_max;
end $$;
revoke all on function public.pvp_rl_hit(text, integer, integer) from public, anon, authenticated;

-- caller IP for RPCs called straight from the browser (PostgREST exposes the request headers). The first
-- x-forwarded-for entry is client-typed, so: cf-connecting-ip, x-real-ip, then the LAST x-forwarded-for hop. Hashed.
create or replace function public.pvp_req_ip() returns text language sql stable set search_path = public as $$
  select md5('pfp-ip:' || coalesce(nullif(h->>'cf-connecting-ip', ''), nullif(h->>'x-real-ip', ''),
    nullif(btrim(reverse(split_part(reverse(coalesce(h->>'x-forwarded-for', '')), ',', 1))), ''), 'unknown'))
  from (select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json as h) x;
$$;
revoke all on function public.pvp_req_ip() from public, anon, authenticated;

-- when this pirate was first seen. Legacy pirates (before 028): the earliest of their kills / saves / airdrop row.
create or replace function public.pvp_first_seen(p text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare f timestamptz;
begin
  select first_seen into f from pvp_identities where player_id = p;
  if found then return f; end if;
  f := least(
    (select min(created_at) from pvp_kills where killer_id = p),
    (select min(created_at) from pvp_kills where victim_id = p),
    (select min(created_at) from pvp_profiles where id = p),
    (select min(created_at) from pvp_dev_profiles where id = p),
    (select min(created_at) from pvp_airdrop where player_id = p),
    (select min(created_at) from pvp_net where player_id = p));
  insert into pvp_identities (player_id, first_seen) values (p, coalesce(f, now())) on conflict (player_id) do nothing;
  select first_seen into f from pvp_identities where player_id = p;
  return f;
end $$;
revoke all on function public.pvp_first_seen(text) from public, anon, authenticated;

-- `ticket` action: is this lobby seat (secret, `${net}${random}`) really seated in that arena / harbor copy right now?
-- Returns the seat state ('play' | 'offer' | 'spec') or null.
create or replace function public.pvp_seat_state(p_seat text, p_kind text, p_prefix text, p_n integer)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_kind = 'arena' then (select state from pvp_seats where seat = p_seat and prefix = p_prefix and state in ('play', 'offer', 'spec'))
    when p_kind = 'harbor' then (select state from pvp_harbor_seats where seat = p_seat and prefix = p_prefix and copy = p_n)
  end;
$$;
revoke all on function public.pvp_seat_state(text, text, text, integer) from public, anon, authenticated;

-- bind a network id to its player (first come) and note the seat in every claim room of the channel.
create or replace function public.pvp_match_join(p_rooms text[], p_net text, p_player text, p_name text, p_ip text)
returns text language plpgsql security definer set search_path = public as $$
declare pid text := pvp_main(p_player); bound text; r text;
begin
  if p_net !~ '^[a-z0-9]{6,20}$' then return 'bad net'; end if;
  insert into pvp_players (id, name, updated_at) values (pid, coalesce(nullif(left(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]<>&"`\\]', '', 'g'), 20), ''), 'PIRATE'), now())
    on conflict (id) do nothing;
  insert into pvp_net (net_id, player_id) values (p_net, pid) on conflict (net_id) do nothing;
  select player_id into bound from pvp_net where net_id = p_net;
  if bound <> pid then return 'net id belongs to another player'; end if;
  perform pvp_first_seen(pid);
  foreach r in array coalesce(p_rooms, '{}') loop
    insert into pvp_match_seats (room, net, player_id, ip_hash, at) values (r, p_net, pid, p_ip, now())
      on conflict (room, net) do update set at = now(), ip_hash = excluded.ip_hash where pvp_match_seats.player_id = excluded.player_id;
  end loop;
  if random() < 0.01 then delete from pvp_match_seats where at < now() - interval '2 days'; end if;
  return 'ok';
end $$;
revoke all on function public.pvp_match_join(text[], text, text, text, text) from public, anon, authenticated;

-- ---------- H2: kill claims (replaces 017's version; same signature, same both-sides matching) ----------
-- New: only the live arenas count (test prefixes made through the public lobby RPC could seat two sybils alone); both pirates must
-- have been seated in that match by the lobby (pvp_match_seats, < 3 h); pirates seen on the same network in the last day, or linked
-- (device <-> wallet, alias), don't count against each other; two brand-new pirates (< 24 h) don't count against each other;
-- max 40 kills a day of one pirate on the same victim; max 30 kills a day on brand-new victims.
-- Real numbers (public board, 2026-11-02): 31 confirmed kills all-time, top pirate 27, so none of this touches real play today;
-- the 6 / min and 600 / day caps from 006 stay.
create or replace function public.pvp_claim_kill(p_player text, p_name text, p_room text, p_killer_net text, p_victim_net text, p_life integer, p_side text)
 returns text language plpgsql security definer set search_path to 'public' as $function$
declare own_net text; bound text; other record; k_id text; v_id text; n int; ks pvp_match_seats; vs pvp_match_seats; kf timestamptz; vf timestamptz;
begin
  p_player := pvp_main(p_player);
  if p_side not in ('k','v') then return 'bad side'; end if;
  if p_killer_net = p_victim_net then return 'self kill'; end if;
  insert into pvp_players (id, name, updated_at) values (p_player, coalesce(nullif(p_name, ''), 'PIRATE'), now())
    on conflict (id) do update set name = case when exists (select 1 from pvp_alias a where a.main = pvp_players.id) then pvp_players.name else excluded.name end, updated_at = now();
  own_net := case when p_side = 'k' then p_killer_net else p_victim_net end;
  insert into pvp_net (net_id, player_id) values (own_net, p_player) on conflict (net_id) do nothing;
  select player_id into bound from pvp_net where net_id = own_net;
  if bound <> p_player then return 'net id belongs to another player'; end if;
  select count(*) into n from pvp_kill_claims where player_id = p_player and created_at > now() - interval '1 minute';
  if n >= 30 then return 'rate limited'; end if;
  if p_room !~ '^pfp-pvp-v1(sq)?-[0-9]{1,2}$' then return 'test room'; end if;  -- [028] live arenas / harbor copies only
  perform pg_advisory_xact_lock(hashtext(p_room || '|' || p_killer_net || '|' || p_victim_net || '|' || p_life));
  if exists (select 1 from pvp_kills where room = p_room and killer_net = p_killer_net and victim_net = p_victim_net and life = p_life) then return 'already recorded'; end if;
  select * into other from pvp_kill_claims where room = p_room and killer_net = p_killer_net and victim_net = p_victim_net and life = p_life
    and side <> p_side and not used and created_at > now() - interval '30 seconds' order by id limit 1;
  if other is null then
    insert into pvp_kill_claims (room, killer_net, victim_net, life, side, player_id) values (p_room, p_killer_net, p_victim_net, p_life, p_side, p_player);
    return 'pending';
  end if;
  update pvp_kill_claims set used = true where id = other.id;
  if p_side = 'k' then k_id := p_player; v_id := other.player_id; else k_id := other.player_id; v_id := p_player; end if;
  if k_id = v_id then return 'self kill'; end if;
  -- [028] both seated in this match by the lobby (the `ticket` action), each net bound to its own pirate
  select * into ks from pvp_match_seats where room = p_room and net = p_killer_net and at > now() - interval '3 hours';
  select * into vs from pvp_match_seats where room = p_room and net = p_victim_net and at > now() - interval '3 hours';
  if ks.net is null or vs.net is null or ks.player_id <> k_id or vs.player_id <> v_id then return 'not seated'; end if;
  -- [028] same network (any match seat in the last day) or linked identities
  if exists (select 1 from pvp_match_seats a join pvp_match_seats b on a.ip_hash = b.ip_hash
             where a.player_id = k_id and b.player_id = v_id and a.at > now() - interval '1 day' and b.at > now() - interval '1 day') then return 'same network'; end if;
  if exists (select 1 from pvp_links l where (l.dev = k_id and l.wallet = v_id) or (l.dev = v_id and l.wallet = k_id))
     or exists (select 1 from pvp_alias a where (a.dev = k_id and a.main = v_id) or (a.dev = v_id and a.main = k_id)) then return 'linked'; end if;
  kf := pvp_first_seen(k_id); vf := pvp_first_seen(v_id);
  if kf > now() - interval '24 hours' and vf > now() - interval '24 hours' then return 'new pair'; end if;
  if exists (select 1 from pvp_kills where killer_id = k_id and victim_id = v_id and created_at > now() - interval '20 seconds') then return 'same victim too soon'; end if;
  select count(*) into n from pvp_kills where killer_id = k_id and created_at > now() - interval '1 minute';
  if n >= 6 then return 'killer rate limited'; end if;
  select count(*) into n from pvp_kills where killer_id = k_id and created_at > now() - interval '1 day';
  if n >= 600 then return 'daily cap'; end if;
  select count(*) into n from pvp_kills where killer_id = k_id and victim_id = v_id and created_at > now() - interval '1 day';
  if n >= 40 then return 'pair cap'; end if;
  if vf > now() - interval '24 hours' then
    select count(*) into n from pvp_kills k join pvp_identities i on i.player_id = k.victim_id
      where k.killer_id = k_id and k.created_at > now() - interval '1 day' and i.first_seen > now() - interval '24 hours';
    if n >= 30 then return 'new victim cap'; end if;
  end if;
  insert into pvp_kills (killer_id, victim_id, room, killer_net, victim_net, life) values (k_id, v_id, p_room, p_killer_net, p_victim_net, p_life)
    on conflict do nothing;
  return 'recorded';
end $function$;
revoke all on function public.pvp_claim_kill(text, text, text, text, text, integer, text) from public, anon, authenticated;

-- ---------- M2: rate-limited lobby RPCs (the anon key can call these straight from any script) ----------
-- Real use: one poll every 3 s while queued / offered (20 / min), 6 s in the harbor, 10 s in the arena, home board peek every 10 s.
-- Limits: 60 calls / min per seat, 600 / min per network (a whole household or a phone carrier's shared IP), 30 NEW seats
-- (play / spec / beat) per 10 min per network. Over the limit = the same 'error' / 'full' answers the client already handles.
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'pvp_lobby_core' and pronamespace = 'public'::regnamespace) then
    alter function public.pvp_lobby(text, text, text, text, int, int) rename to pvp_lobby_core;
  end if;
  if not exists (select 1 from pg_proc where proname = 'pvp_harbor_core' and pronamespace = 'public'::regnamespace) then
    alter function public.pvp_harbor(text, text, text, text, int) rename to pvp_harbor_core;
  end if;
end $$;
revoke all on function public.pvp_lobby_core(text, text, text, text, int, int) from public, anon, authenticated;
revoke all on function public.pvp_harbor_core(text, text, text, text, int) from public, anon, authenticated;

create or replace function public.pvp_lobby(p_seat text, p_prefix text, p_op text, p_name text default null, p_cap int default null, p_offer int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ip text := pvp_req_ip();
begin
  if not pvp_rl_hit('li:' || ip, 60, 600) then return jsonb_build_object('state', 'error', 'why', 'rate'); end if;
  if p_seat is not null and not pvp_rl_hit('ls:' || left(p_seat, 40), 60, 60) then return jsonb_build_object('state', 'error', 'why', 'rate'); end if;
  if p_op in ('play', 'spec') and not exists (select 1 from pvp_seats where seat = p_seat)
     and not pvp_rl_hit('lj:' || ip, 600, 30) then return jsonb_build_object('state', 'full', 'why', 'rate'); end if;
  return pvp_lobby_core(p_seat, p_prefix, p_op, p_name, p_cap, p_offer);
end $$;
revoke all on function public.pvp_lobby(text, text, text, text, int, int) from public;
grant execute on function public.pvp_lobby(text, text, text, text, int, int) to anon, authenticated;

create or replace function public.pvp_harbor(p_seat text, p_prefix text, p_op text, p_name text default null, p_cap int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ip text := pvp_req_ip();
begin
  if not pvp_rl_hit('hi:' || ip, 60, 600) then return jsonb_build_object('state', 'error', 'why', 'rate'); end if;
  if p_seat is not null and not pvp_rl_hit('hs:' || left(p_seat, 40), 60, 60) then return jsonb_build_object('state', 'error', 'why', 'rate'); end if;
  if p_op in ('beat', 'spec') and not exists (select 1 from pvp_harbor_seats where seat = p_seat)
     and not pvp_rl_hit('hj:' || ip, 600, 30) then return jsonb_build_object('state', 'full', 'why', 'rate'); end if;
  return pvp_harbor_core(p_seat, p_prefix, p_op, p_name, p_cap);
end $$;
revoke all on function public.pvp_harbor(text, text, text, text, int) from public;
grant execute on function public.pvp_harbor(text, text, text, text, int) to anon, authenticated;

commit;

-- ROLLBACK (run as one script; restores 027 behaviour, keeps the new columns / tables, which nothing old reads):
-- begin;
--   drop function if exists public.pvp_lobby(text, text, text, text, int, int);
--   alter function public.pvp_lobby_core(text, text, text, text, int, int) rename to pvp_lobby;
--   grant execute on function public.pvp_lobby(text, text, text, text, int, int) to anon, authenticated;
--   drop function if exists public.pvp_harbor(text, text, text, text, int);
--   alter function public.pvp_harbor_core(text, text, text, text, int) rename to pvp_harbor;
--   grant execute on function public.pvp_harbor(text, text, text, text, int) to anon, authenticated;
--   -- then re-run the pvp_claim_kill definition from 017_banksy_owner_merge.sql
-- commit;
