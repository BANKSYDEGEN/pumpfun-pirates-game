-- PUMPFUN PIRATES · migration 007: PvP ARENA LOBBY (arena seats + FIFO queue) for the Supabase Realtime fallback transport.
-- NEW objects only. One authority (an advisory lock) so seat handoffs never race.
-- Realtime FREE plan: 100 msgs/sec project-wide (every message sent OR delivered), 200 connections, presence 20/s (we use none).
-- Clients batch everything into ONE broadcast per tick, so an arena of N players at r Hz with S spectators costs N·r·(N+S)/s
-- (1 send + N+S−1 deliveries per message); a lone player ticks at 1 Hz. Constants (keep in sync with js/config.js PVP_NET.supabase):
--   r = 4 Hz, MAX_ARENA = 4 (4·4·4 = 64/s), budget = 80/s (20% headroom; +1 spectator = 80/s). Harbor/queue = 0 Realtime msgs.
-- Flow: everyone starts in the local HARBOR (no seat). JOIN BATTLE → op 'play': a free slot and an empty queue = play now,
--   otherwise 'queue'. A freed slot is OFFERED to the queue head for 15 s ('accept' → play). A missed / declined offer keeps the
--   place once (the slot goes to the next pirate, they stay at the front); the second miss moves them to the back.
--   'died' while the queue is non-empty = rotation: the dying seat goes to the BACK of the queue. 'leave' = back to the harbor.
create table if not exists public.pvp_seats (
  seat text primary key check (char_length(seat) between 12 and 40),
  prefix text not null check (char_length(prefix) between 3 and 40),
  state text not null check (state in ('play', 'queue', 'offer', 'spec')),
  name text not null default 'PIRATE',
  enq timestamptz not null default now(),
  misses int not null default 0,
  skip_until timestamptz not null default '-infinity',
  offer_until timestamptz,
  seen timestamptz not null default now()
);
alter table public.pvp_seats add column if not exists misses int not null default 0;
alter table public.pvp_seats add column if not exists skip_until timestamptz not null default '-infinity';
alter table public.pvp_seats add column if not exists offer_until timestamptz;
alter table public.pvp_seats drop column if exists ready_at;
alter table public.pvp_seats drop constraint if exists pvp_seats_state_check;
alter table public.pvp_seats add constraint pvp_seats_state_check check (state in ('play', 'queue', 'offer', 'spec'));
create index if not exists pvp_seats_prefix_idx on public.pvp_seats (prefix, state, enq);
alter table public.pvp_seats enable row level security;
revoke all on public.pvp_seats from anon, authenticated;

-- project-wide Realtime load (msgs/s) of every arena; an offered seat counts as a player (its slot is reserved)
create or replace function public.pvp_lobby_load() returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when n = 0 then 0 when n = 1 then 1.0 * (1 + s) else n * 4.0 * (n + s) end), 0)
  from (select prefix, count(*) filter (where state in ('play', 'offer')) n, count(*) filter (where state = 'spec') s from pvp_seats group by prefix) t;
$$;

drop function if exists public.pvp_lobby(text, text, text, text, int);
create or replace function public.pvp_lobby(p_seat text, p_prefix text, p_op text, p_name text default null, p_cap int default null, p_offer int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  hz constant numeric := 4; budget constant numeric := 80; max_queue constant int := 100;
  cap int; offer_s int; r pvp_seats; n int; s int; q int; pos int; head pvp_seats; load numeric; was boolean;
begin
  if p_seat is null or char_length(p_seat) not between 12 and 40 or p_prefix is null or p_prefix !~ '^pfp-pvp-[a-zA-Z0-9]{1,16}$'
     or p_op not in ('play', 'spec', 'poll', 'accept', 'decline', 'died', 'leave') then
    return jsonb_build_object('state', 'error');
  end if;
  perform pg_advisory_xact_lock(hashtext('pvp_lobby'));
  delete from pvp_seats where seen < now() - (case when state = 'play' then interval '25 seconds' else interval '15 seconds' end);
  -- the live arena is capped at 4 (budget); test prefixes may ask for a smaller cap / shorter offer to exercise the queue
  cap := (case when p_prefix = 'pfp-pvp-v1' then 4 else least(greatest(coalesce(p_cap, 4), 1), 4) end);
  offer_s := (case when p_prefix = 'pfp-pvp-v1' then 15 else least(greatest(coalesce(p_offer, 15), 3), 15) end);
  -- expired offers: keep the place once, the second miss goes to the back of the line
  update pvp_seats set state = 'queue', misses = misses + 1, skip_until = now() + interval '20 seconds', offer_until = null
    where prefix = p_prefix and state = 'offer' and offer_until < now();
  update pvp_seats set misses = 0, enq = clock_timestamp() where prefix = p_prefix and state = 'queue' and misses >= 2;

  select * into r from pvp_seats where seat = p_seat;
  was := found;
  if p_op = 'leave' then
    delete from pvp_seats where seat = p_seat;
  elsif was then
    update pvp_seats set seen = now(), name = coalesce(left(p_name, 20), name) where seat = p_seat;
    if p_op = 'accept' and r.state = 'offer' then
      update pvp_seats set state = 'play', misses = 0, offer_until = null where seat = p_seat;
    elsif p_op = 'decline' and r.state = 'offer' then
      update pvp_seats set state = 'queue', misses = r.misses + 1, skip_until = now() + interval '20 seconds', offer_until = null,
        enq = (case when r.misses + 1 >= 2 then clock_timestamp() else r.enq end) where seat = p_seat;
      update pvp_seats set misses = 0 where seat = p_seat and misses >= 2;
    elsif p_op = 'died' and r.state = 'play' and exists (select 1 from pvp_seats where prefix = p_prefix and state = 'queue') then
      update pvp_seats set state = 'queue', enq = clock_timestamp(), misses = 0, skip_until = '-infinity' where seat = p_seat; -- rotation
    end if;
  elsif p_op = 'spec' then
    select count(*) filter (where state in ('play', 'offer')) into n from pvp_seats where prefix = p_prefix;
    load := pvp_lobby_load() + (case when n = 1 then 1 else n * hz end);
    if load > budget then
      return jsonb_build_object('state', 'full', 'why', 'spectators');
    end if;
    insert into pvp_seats (seat, prefix, state, name) values (p_seat, p_prefix, 'spec', coalesce(left(p_name, 20), 'PIRATE'));
  elsif p_op = 'play' then
    select count(*) filter (where state in ('play', 'offer')), count(*) filter (where state = 'spec'), count(*) filter (where state = 'queue')
      into n, s, q from pvp_seats where prefix = p_prefix;
    if q >= max_queue then
      return jsonb_build_object('state', 'full', 'why', 'queue');
    end if;
    load := pvp_lobby_load() - (case when n = 0 then 0 when n = 1 then 1 + s else n * hz * (n + s) end)
            + (case when n = 0 then 1 + s else (n + 1) * hz * (n + 1 + s) end);
    insert into pvp_seats (seat, prefix, state, name, enq) values (p_seat, p_prefix,
      (case when q = 0 and n < cap and load <= budget then 'play' else 'queue' end), coalesce(left(p_name, 20), 'PIRATE'), clock_timestamp());
  end if;

  -- offer free slots to the queue (FIFO, skipping pirates who just missed an offer), within the project-wide budget
  loop
    select count(*) filter (where state in ('play', 'offer')), count(*) filter (where state = 'spec') into n, s from pvp_seats where prefix = p_prefix;
    exit when n >= cap;
    select * into head from pvp_seats where prefix = p_prefix and state = 'queue' and skip_until < now() order by enq, seat limit 1;
    exit when not found;
    load := pvp_lobby_load() - (case when n = 0 then 0 when n = 1 then 1 + s else n * hz * (n + s) end)
            + (case when n = 0 then 1 + s else (n + 1) * hz * (n + 1 + s) end);
    exit when load > budget;
    update pvp_seats set state = 'offer', offer_until = now() + make_interval(secs => offer_s) where seat = head.seat;
  end loop;

  if p_op = 'leave' then return jsonb_build_object('state', 'harbor'); end if;
  select * into r from pvp_seats where seat = p_seat;
  if not found then return jsonb_build_object('state', 'harbor'); end if;
  select count(*) filter (where state = 'play'), count(*) filter (where state = 'queue'), count(*) filter (where state = 'spec') into n, q, s from pvp_seats where prefix = p_prefix;
  if r.state = 'queue' then
    select count(*) + 1 into pos from pvp_seats where prefix = p_prefix and state in ('queue', 'offer') and (enq, seat) < (r.enq, r.seat);
  end if;
  return jsonb_build_object('state', r.state, 'room', 1, 'pos', pos, 'queue', q, 'players', n, 'spectators', s, 'cap', cap,
    'offer_in', (case when r.state = 'offer' then greatest(0, extract(epoch from (r.offer_until - now())))::numeric(5, 1) end),
    'misses', r.misses, 'hz', hz, 'load', pvp_lobby_load(), 'budget', budget);
end $$;
revoke all on function public.pvp_lobby(text, text, text, text, int, int) from public;
revoke all on function public.pvp_lobby_load() from public, anon, authenticated;
grant execute on function public.pvp_lobby(text, text, text, text, int, int) to anon, authenticated;

-- ---------------- HOLDER PERK (web only): wallets holding >= 1 $SUNK or >= 1 $AHOY ----------------
-- The `pvp` Edge Function (service role) checks the balance SERVER-SIDE (public Solana RPC, read-only getTokenAccountsByOwner),
-- caches it here ~10 min, and records ONE daily gold claim per wallet per America/Indianapolis day. No transactions, ever.
-- New tables only; existing scores and the Top Pirates leaderboard are untouched.
create table if not exists public.pvp_holders (
  wallet text primary key check (wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  holder boolean not null default false,
  sunk numeric not null default 0,
  ahoy numeric not null default 0,
  checked_at timestamptz not null default now()
);
create table if not exists public.pvp_holder_claims (
  wallet text not null check (wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  day date not null,
  gold int not null check (gold between 1 and 1000),
  created_at timestamptz not null default now(),
  primary key (wallet, day)
);
alter table public.pvp_holders enable row level security;
alter table public.pvp_holder_claims enable row level security;
revoke all on public.pvp_holders, public.pvp_holder_claims from anon, authenticated;
-- atomic claim: insert today's row (Indianapolis day) + credit the wallet's PvP save; false when already claimed
create or replace function public.pvp_holder_claim(p_wallet text, p_gold int) returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'America/Indiana/Indianapolis')::date; g bigint;
begin
  insert into pvp_holder_claims (wallet, day, gold) values (p_wallet, d, p_gold) on conflict do nothing;
  if not found then return jsonb_build_object('ok', false, 'day', d, 'why', 'already claimed today'); end if;
  update pvp_profiles set gold = gold + p_gold where id = 'wallet:' || p_wallet returning gold into g;
  return jsonb_build_object('ok', true, 'day', d, 'gold', g);
end $$;
revoke all on function public.pvp_holder_claim(text, int) from public, anon, authenticated;
