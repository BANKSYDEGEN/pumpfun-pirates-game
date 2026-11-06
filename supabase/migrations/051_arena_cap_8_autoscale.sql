-- [v339] BANKSY t1800u: Solo Arena (pfp-pvp-v1) capacity 4 -> 8 on $0 Free Supabase with automatic tick-rate scaling.
-- SQUADS (pfp-pvp-v1sq) stays 2v2 / cap 4. Load uses pvp_arena_hz / pvp_arena_room_load so N·r·(N+S) stays <= 76.8 (<= 80 budget).
-- 028_security_core wraps pvp_lobby -> pvp_lobby_core; update the CORE (and the load helper). Idempotent.

create or replace function public.pvp_arena_hz(p_n int, p_s int default 0)
returns numeric
language sql
immutable
security definer
set search_path = public
as $$
  select case
    when coalesce(p_n, 0) <= 0 then 0::numeric
    when p_n = 1 then 1.0
    else greatest(1.0, least(4.0, round(76.8 / greatest(1, p_n * (p_n + greatest(coalesce(p_s, 0), 0))), 3)))
  end;
$$;
revoke execute on function public.pvp_arena_hz(int, int) from public, anon, authenticated;

create or replace function public.pvp_arena_room_load(p_n int, p_s int default 0)
returns numeric
language sql
immutable
security definer
set search_path = public
as $$
  select case
    when coalesce(p_n, 0) <= 0 then 0::numeric
    else round(p_n * pvp_arena_hz(p_n, p_s) * (p_n + greatest(coalesce(p_s, 0), 0)), 2)
  end;
$$;
revoke execute on function public.pvp_arena_room_load(int, int) from public, anon, authenticated;

create or replace function public.pvp_lobby_load()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(pvp_arena_room_load(n::int, s::int)), 0)
  from (
    select prefix,
      count(*) filter (where state in ('play', 'offer')) as n,
      count(*) filter (where state = 'spec') as s
    from pvp_seats
    group by prefix
  ) t;
$$;

create or replace function public.pvp_lobby_core(
  p_seat text, p_prefix text, p_op text,
  p_name text default null::text, p_cap integer default null::integer, p_offer integer default null::integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  budget constant numeric := 80; max_queue constant int := 100;
  cap int; offer_s int; r pvp_seats; n int; s int; q int; pos int; head pvp_seats; load numeric; was boolean;
begin
  if p_seat is null or char_length(p_seat) not between 12 and 40 or p_prefix is null or p_prefix !~ '^pfp-pvp-[a-zA-Z0-9]{1,16}$'
     or p_op not in ('play', 'spec', 'poll', 'accept', 'decline', 'died', 'leave') then
    return jsonb_build_object('state', 'error');
  end if;
  perform pg_advisory_xact_lock(hashtext('pvp_lobby'));
  delete from pvp_seats where seen < now() - (case when state = 'play' then interval '25 seconds' else interval '15 seconds' end);
  -- [v339] Solo Arena pfp-pvp-v1 = 8 ships; SQUADS pfp-pvp-v1sq stays 2v2 / 4; test prefixes up to 8
  cap := (case when p_prefix = 'pfp-pvp-v1' then 8 when p_prefix = 'pfp-pvp-v1sq' then 4 else least(greatest(coalesce(p_cap, 8), 1), 8) end);
  offer_s := (case when p_prefix in ('pfp-pvp-v1', 'pfp-pvp-v1sq') then 15 else least(greatest(coalesce(p_offer, 15), 3), 15) end);
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
      update pvp_seats set state = 'queue', enq = clock_timestamp(), misses = 0, skip_until = '-infinity' where seat = p_seat;
    end if;
  elsif p_op = 'spec' then
    select count(*) filter (where state in ('play', 'offer')), count(*) filter (where state = 'spec')
      into n, s from pvp_seats where prefix = p_prefix;
    load := pvp_lobby_load() - pvp_arena_room_load(n, s) + pvp_arena_room_load(n, s + 1);
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
    load := pvp_lobby_load() - pvp_arena_room_load(n, s) + pvp_arena_room_load(n + 1, s);
    insert into pvp_seats (seat, prefix, state, name, enq) values (p_seat, p_prefix,
      (case when q = 0 and n < cap and load <= budget then 'play' else 'queue' end), coalesce(left(p_name, 20), 'PIRATE'), clock_timestamp());
  end if;

  loop
    select count(*) filter (where state in ('play', 'offer')), count(*) filter (where state = 'spec') into n, s from pvp_seats where prefix = p_prefix;
    exit when n >= cap;
    select * into head from pvp_seats where prefix = p_prefix and state = 'queue' and skip_until < now() order by enq, seat limit 1;
    exit when not found;
    load := pvp_lobby_load() - pvp_arena_room_load(n, s) + pvp_arena_room_load(n + 1, s);
    exit when load > budget;
    update pvp_seats set state = 'offer', offer_until = now() + make_interval(secs => offer_s) where seat = head.seat;
  end loop;

  select count(*) filter (where state = 'play'), count(*) filter (where state = 'queue'), count(*) filter (where state = 'spec') into n, q, s from pvp_seats where prefix = p_prefix;
  if p_op = 'leave' then return jsonb_build_object('state', 'harbor', 'players', n, 'spectators', s, 'queue', q, 'cap', cap); end if;
  select * into r from pvp_seats where seat = p_seat;
  if not found then return jsonb_build_object('state', 'harbor', 'players', n, 'spectators', s, 'queue', q, 'cap', cap); end if;
  if r.state = 'queue' then
    select count(*) + 1 into pos from pvp_seats where prefix = p_prefix and state in ('queue', 'offer') and (enq, seat) < (r.enq, r.seat);
  end if;
  return jsonb_build_object('state', r.state, 'room', 1, 'pos', pos, 'queue', q, 'players', n, 'spectators', s, 'cap', cap,
    'offer_in', (case when r.state = 'offer' then greatest(0, extract(epoch from (r.offer_until - now())))::numeric(5, 1) end),
    'misses', r.misses, 'hz', pvp_arena_hz(greatest(n, 1), s), 'load', pvp_lobby_load(), 'budget', budget);
end
$function$;

revoke all on function public.pvp_lobby_core(text, text, text, text, int, int) from public, anon, authenticated;
