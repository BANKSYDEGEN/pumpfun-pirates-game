-- [scale] BANKSY t2494u "continue the scaling" (capacity review Fix 3).
-- Remove the two GLOBAL advisory locks (hashtext('pvp_harbor') / hashtext('pvp_lobby')) that serialized every
-- heartbeat, title-screen poll, and peek behind one lock (the 170–330 calls/s ceiling, and the PostgREST pool pile-up).
-- Behaviour of seating, caps, budgets, offers and heartbeats stays the same.
--
--   * peek, and lobby poll when the caller has no seat, are lock-free read-only (no stale-row cleanup).
--   * Harbor / lobby heartbeats (existing seat) only UPDATE their own row. Stale cleanup is opportunistic
--     (pg_try_advisory_xact_lock) so one cleanup runs at a time.
--   * New seats and victim moves take a short budget lock + a per-prefix lock (never the old process-wide key).
--   * The rate-limit wrappers skip pvp_rl writes for those read-only calls (title-screen traffic).
--
-- Do not apply on prod without BANKSY's own-words OK. No pg_cron (Free plan). Idempotent create-or-replace.

begin;

-- ---------- harbor: opportunistic stale-seat cleanup (20 s, same as 050) ----------
create or replace function public.pvp_harbor_gc()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not pg_try_advisory_xact_lock(hashtext('pvp_harbor_gc')) then return; end if;
  delete from pvp_harbor_seats where seen < now() - interval '20 seconds';
end;
$$;
revoke all on function public.pvp_harbor_gc() from public, anon, authenticated;

create or replace function public.pvp_harbor_view(p_prefix text, p_seat text, p_op text, p_cap int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r pvp_harbor_seats;
begin
  select * into r from pvp_harbor_seats where seat = p_seat;
  return jsonb_build_object(
    'state', (case when p_op = 'peek' then 'peek' when r.seat is null then 'none' else r.state end),
    'copy', r.copy,
    'n', (select count(*) from pvp_harbor_seats where prefix = p_prefix and copy = r.copy and state = 'play'),
    's', (select count(*) from pvp_harbor_seats where prefix = p_prefix and copy = r.copy and state = 'spec'),
    'cap', p_cap,
    'pirates', (select count(*) from pvp_harbor_seats where prefix = p_prefix and state = 'play'),
    'copies', (select coalesce(jsonb_agg(jsonb_build_array(t.copy, t.k) order by t.copy), '[]'::jsonb)
               from (select h.copy, count(*) filter (where h.state = 'play') k from pvp_harbor_seats h where h.prefix = p_prefix group by h.copy) t),
    'load', round(pvp_lobby_load() + pvp_harbor_load(), 1));
end;
$$;
revoke all on function public.pvp_harbor_view(text, text, text, int) from public, anon, authenticated;

create or replace function public.pvp_harbor_core(p_seat text, p_prefix text, p_op text, p_name text default null, p_cap int default null, p_want_copy int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rate constant numeric := 1.2; total_max constant numeric := 95; harbor_max constant numeric := 80; max_copies constant int := 60;
  cap int; r pvp_harbor_seats; c int; n int; s int; arena numeric; hb numeric; room_load numeric; delta numeric; victim pvp_harbor_seats; free_c int;
  want int;
begin
  if p_seat is null or char_length(p_seat) not between 12 and 40 or p_prefix is null or p_prefix !~ '^pfp-harbor(-[a-zA-Z0-9]{1,16})?$'
     or p_op not in ('beat', 'spec', 'peek', 'leave') then
    return jsonb_build_object('state', 'error');
  end if;
  cap := (case when p_prefix = 'pfp-harbor' then 8 else least(greatest(coalesce(p_cap, 8), 1), 8) end);
  want := case when p_want_copy = -1 then -1 when p_want_copy is not null and p_want_copy between 1 and max_copies then p_want_copy else null end;

  if p_op = 'peek' then
    return pvp_harbor_view(p_prefix, p_seat, p_op, cap);
  end if;

  if p_op = 'leave' then
    perform pg_advisory_xact_lock(hashtext('pvp_harbor:' || p_prefix));
    delete from pvp_harbor_seats where seat = p_seat;
    return jsonb_build_object('state', 'left');
  end if;

  select * into r from pvp_harbor_seats where seat = p_seat;
  if found then
    update pvp_harbor_seats set seen = now(), name = coalesce(left(p_name, 20), name) where seat = p_seat;
    if r.prefix <> p_prefix or (p_op = 'beat' and r.state <> 'play') or (p_op = 'spec' and r.state <> 'spec') then
      perform pg_advisory_xact_lock(hashtext('pvp_harbor_budget'));
      perform pg_advisory_xact_lock(hashtext('pvp_harbor:' || p_prefix));
      delete from pvp_harbor_seats where seat = p_seat; r := null;
    end if;
  end if;

  -- existing-seat heartbeat: no global lock. Occasional stale cleanup (try-lock, never blocks the beat).
  if r.seat is not null then
    if random() < 0.05 then perform pvp_harbor_gc(); end if;
    return pvp_harbor_view(p_prefix, p_seat, p_op, cap);
  end if;

  -- new seat (beat / spec): serialize budget + this prefix only
  perform pg_advisory_xact_lock(hashtext('pvp_harbor_budget'));
  perform pg_advisory_xact_lock(hashtext('pvp_harbor:' || p_prefix));
  delete from pvp_harbor_seats where seen < now() - interval '20 seconds';
  arena := pvp_lobby_load();

  if p_op = 'beat' then
    hb := pvp_harbor_load();
    if arena + hb > total_max or hb > harbor_max then
      select h.* into victim from pvp_harbor_seats h
        where h.state = 'play' and (select count(*) from pvp_harbor_seats x where x.prefix = h.prefix and x.copy = h.copy) >= 2
        order by h.joined desc limit 1;
      if victim.seat is not null then
        select min(g) into free_c from generate_series(1, max_copies) g
          where not exists (select 1 from pvp_harbor_seats x where x.prefix = victim.prefix and x.copy = g);
        if free_c is not null then update pvp_harbor_seats set copy = free_c, joined = clock_timestamp() where seat = victim.seat; end if;
      end if;
    end if;
    hb := pvp_harbor_load(); c := null;
    if want = -1 then
      select min(g) into free_c from generate_series(1, max_copies) g
        where not exists (select 1 from pvp_harbor_seats x where x.prefix = p_prefix and x.copy = g);
      if free_c is not null and arena + hb + rate <= total_max and hb + rate <= harbor_max then c := free_c; end if;
    elsif want is not null then
      select count(*) filter (where state = 'play'), count(*) filter (where state = 'spec') into n, s
        from pvp_harbor_seats where prefix = p_prefix and copy = want;
      n := coalesce(n, 0); s := coalesce(s, 0);
      if n < cap then
        room_load := (case when n + s >= 2 then n * rate * (n + s) else 0 end);
        delta := (n + 1) * rate * (n + 1 + s) - room_load;
        if arena + hb + delta <= total_max and hb + delta <= harbor_max then c := want; end if;
      end if;
    end if;
    if c is null then
      for c, n, s in
        select copy, count(*) filter (where state = 'play'), count(*) filter (where state = 'spec') from pvp_harbor_seats
          where prefix = p_prefix group by copy order by copy
      loop
        if n >= 1 and n < cap then
          room_load := (case when n + s >= 2 then n * rate * (n + s) else 0 end);
          delta := (n + 1) * rate * (n + 1 + s) - room_load;
          if arena + hb + delta <= total_max and hb + delta <= harbor_max then exit; end if;
        end if;
        c := null;
      end loop;
    end if;
    if c is null then
      select min(g) into c from generate_series(1, max_copies) g
        where not exists (select 1 from pvp_harbor_seats x where x.prefix = p_prefix and x.copy = g);
    end if;
    if c is null then return jsonb_build_object('state', 'full'); end if;
    insert into pvp_harbor_seats (seat, prefix, copy, state, name) values (p_seat, p_prefix, c, 'play', coalesce(left(p_name, 20), 'PIRATE'));
  elsif p_op = 'spec' then
    select copy, count(*) filter (where state = 'play'), count(*) filter (where state = 'spec') into c, n, s from pvp_harbor_seats
      where prefix = p_prefix group by copy having count(*) filter (where state = 'play') > 0 order by 2 desc, copy limit 1;
    if c is null then return jsonb_build_object('state', 'empty', 'pirates', 0); end if;
    hb := pvp_harbor_load();
    delta := n * rate * (n + s + 1) - (case when n + s >= 2 then n * rate * (n + s) else 0 end);
    if arena + hb + delta > total_max or hb + delta > harbor_max then return jsonb_build_object('state', 'full', 'why', 'spectators'); end if;
    insert into pvp_harbor_seats (seat, prefix, copy, state, name) values (p_seat, p_prefix, c, 'spec', coalesce(left(p_name, 20), 'PIRATE'));
  end if;

  return pvp_harbor_view(p_prefix, p_seat, p_op, cap);
end;
$$;
revoke all on function public.pvp_harbor_core(text, text, text, text, int, int) from public, anon, authenticated;

-- Rate-limit wrapper: peek is read-only (no pvp_rl write). beat / spec / leave stay limited as in 041.
create or replace function public.pvp_harbor(p_seat text, p_prefix text, p_op text, p_name text default null, p_cap int default null, p_want_copy int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ip text;
begin
  if p_op = 'peek' then
    return pvp_harbor_core(p_seat, p_prefix, p_op, p_name, p_cap, p_want_copy);
  end if;
  ip := pvp_req_ip();
  if not pvp_rl_hit('hi:' || ip, 60, 600) then return jsonb_build_object('state', 'error', 'why', 'rate'); end if;
  if p_seat is not null and not pvp_rl_hit('hs:' || left(p_seat, 40), 60, 60) then return jsonb_build_object('state', 'error', 'why', 'rate'); end if;
  if p_op in ('beat', 'spec') and not exists (select 1 from pvp_harbor_seats where seat = p_seat)
     and not pvp_rl_hit('hj:' || ip, 600, 30) then return jsonb_build_object('state', 'full', 'why', 'rate'); end if;
  return pvp_harbor_core(p_seat, p_prefix, p_op, p_name, p_cap, p_want_copy);
end $$;
revoke all on function public.pvp_harbor(text, text, text, text, int, int) from public;
grant execute on function public.pvp_harbor(text, text, text, text, int, int) to anon, authenticated;

-- ---------- lobby: opportunistic stale-seat cleanup (same windows as 051) ----------
create or replace function public.pvp_lobby_gc()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not pg_try_advisory_xact_lock(hashtext('pvp_lobby_gc')) then return; end if;
  delete from pvp_seats where seen < now() - (case when state = 'play' then interval '25 seconds' else interval '15 seconds' end);
end;
$$;
revoke all on function public.pvp_lobby_gc() from public, anon, authenticated;

create or replace function public.pvp_lobby_snapshot(p_prefix text, p_cap int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare n int; q int; s int;
begin
  select count(*) filter (where state = 'play'), count(*) filter (where state = 'queue'), count(*) filter (where state = 'spec')
    into n, q, s from pvp_seats where prefix = p_prefix;
  return jsonb_build_object('state', 'harbor', 'players', n, 'spectators', s, 'queue', q, 'cap', p_cap);
end;
$$;
revoke all on function public.pvp_lobby_snapshot(text, int) from public, anon, authenticated;

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
  cap := (case when p_prefix = 'pfp-pvp-v1' then 8 when p_prefix = 'pfp-pvp-v1sq' then 4 else least(greatest(coalesce(p_cap, 8), 1), 8) end);
  offer_s := (case when p_prefix in ('pfp-pvp-v1', 'pfp-pvp-v1sq') then 15 else least(greatest(coalesce(p_offer, 15), 3), 15) end);

  -- title-screen / home-board poll: no seat, no lock, no cleanup (the live line is players / queue / cap / spectators)
  if p_op = 'poll' then
    select * into r from pvp_seats where seat = p_seat;
    if not found then
      return pvp_lobby_snapshot(p_prefix, cap);
    end if;
    update pvp_seats set seen = now(), name = coalesce(left(p_name, 20), name) where seat = p_seat;
    update pvp_seats set state = 'queue', misses = misses + 1, skip_until = now() + interval '20 seconds', offer_until = null
      where seat = p_seat and state = 'offer' and offer_until < now();
    update pvp_seats set misses = 0, enq = clock_timestamp() where seat = p_seat and state = 'queue' and misses >= 2;
    -- try to run offer promotion / global offer expiry without blocking the heartbeat if someone else holds the locks
    if pg_try_advisory_xact_lock(hashtext('pvp_lobby_budget')) and pg_try_advisory_xact_lock(hashtext('pvp_lobby:' || p_prefix)) then
      perform pvp_lobby_gc();
      update pvp_seats set state = 'queue', misses = misses + 1, skip_until = now() + interval '20 seconds', offer_until = null
        where prefix = p_prefix and state = 'offer' and offer_until < now();
      update pvp_seats set misses = 0, enq = clock_timestamp() where prefix = p_prefix and state = 'queue' and misses >= 2;
      loop
        select count(*) filter (where state in ('play', 'offer')), count(*) filter (where state = 'spec') into n, s from pvp_seats where prefix = p_prefix;
        exit when n >= cap;
        select * into head from pvp_seats where prefix = p_prefix and state = 'queue' and skip_until < now() order by enq, seat limit 1;
        exit when not found;
        load := pvp_lobby_load() - pvp_arena_room_load(n, s) + pvp_arena_room_load(n + 1, s);
        exit when load > budget;
        update pvp_seats set state = 'offer', offer_until = now() + make_interval(secs => offer_s) where seat = head.seat;
      end loop;
    end if;
    select count(*) filter (where state = 'play'), count(*) filter (where state = 'queue'), count(*) filter (where state = 'spec') into n, q, s from pvp_seats where prefix = p_prefix;
    select * into r from pvp_seats where seat = p_seat;
    if not found then return jsonb_build_object('state', 'harbor', 'players', n, 'spectators', s, 'queue', q, 'cap', cap); end if;
    if r.state = 'queue' then
      select count(*) + 1 into pos from pvp_seats where prefix = p_prefix and state in ('queue', 'offer') and (enq, seat) < (r.enq, r.seat);
    end if;
    return jsonb_build_object('state', r.state, 'room', 1, 'pos', pos, 'queue', q, 'players', n, 'spectators', s, 'cap', cap,
      'offer_in', (case when r.state = 'offer' then greatest(0, extract(epoch from (r.offer_until - now())))::numeric(5, 1) end),
      'misses', r.misses, 'hz', pvp_arena_hz(greatest(n, 1), s), 'load', pvp_lobby_load(), 'budget', budget);
  end if;

  -- play / spec / accept / decline / died / leave: per-prefix lock; new admissions also take the budget lock
  if p_op in ('play', 'spec') then
    perform pg_advisory_xact_lock(hashtext('pvp_lobby_budget'));
  end if;
  perform pg_advisory_xact_lock(hashtext('pvp_lobby:' || p_prefix));
  delete from pvp_seats where seen < now() - (case when state = 'play' then interval '25 seconds' else interval '15 seconds' end);
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

-- Rate-limit wrapper: a poll from a caller with no seat (title / home board) is read-only and skips pvp_rl writes.
create or replace function public.pvp_lobby(p_seat text, p_prefix text, p_op text, p_name text default null, p_cap int default null, p_offer int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ip text;
begin
  if p_op = 'poll' and not exists (select 1 from pvp_seats where seat = p_seat) then
    return pvp_lobby_core(p_seat, p_prefix, p_op, p_name, p_cap, p_offer);
  end if;
  ip := pvp_req_ip();
  if not pvp_rl_hit('li:' || ip, 60, 600) then return jsonb_build_object('state', 'error', 'why', 'rate'); end if;
  if p_seat is not null and not pvp_rl_hit('ls:' || left(p_seat, 40), 60, 60) then return jsonb_build_object('state', 'error', 'why', 'rate'); end if;
  if p_op in ('play', 'spec') and not exists (select 1 from pvp_seats where seat = p_seat)
     and not pvp_rl_hit('lj:' || ip, 600, 30) then return jsonb_build_object('state', 'full', 'why', 'rate'); end if;
  return pvp_lobby_core(p_seat, p_prefix, p_op, p_name, p_cap, p_offer);
end $$;
revoke all on function public.pvp_lobby(text, text, text, text, int, int) from public;
grant execute on function public.pvp_lobby(text, text, text, text, int, int) to anon, authenticated;

commit;
