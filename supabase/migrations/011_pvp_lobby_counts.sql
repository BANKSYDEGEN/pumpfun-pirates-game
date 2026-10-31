-- v71: harbor polls (no seat) also return the live arena head-count: players / spectators / queue / cap.
-- Same function otherwise (007); no table changes, nothing deleted.
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

  select count(*) filter (where state = 'play'), count(*) filter (where state = 'queue'), count(*) filter (where state = 'spec') into n, q, s from pvp_seats where prefix = p_prefix;
  -- [v71] the harbor shows the live arena head-count too (read only: harbor pirates hold no seat)
  if p_op = 'leave' then return jsonb_build_object('state', 'harbor', 'players', n, 'spectators', s, 'queue', q, 'cap', cap); end if;
  select * into r from pvp_seats where seat = p_seat;
  if not found then return jsonb_build_object('state', 'harbor', 'players', n, 'spectators', s, 'queue', q, 'cap', cap); end if;
  if r.state = 'queue' then
    select count(*) + 1 into pos from pvp_seats where prefix = p_prefix and state in ('queue', 'offer') and (enq, seat) < (r.enq, r.seat);
  end if;
  return jsonb_build_object('state', r.state, 'room', 1, 'pos', pos, 'queue', q, 'players', n, 'spectators', s, 'cap', cap,
    'offer_in', (case when r.state = 'offer' then greatest(0, extract(epoch from (r.offer_until - now())))::numeric(5, 1) end),
    'misses', r.misses, 'hz', hz, 'load', pvp_lobby_load(), 'budget', budget);
end $$;
