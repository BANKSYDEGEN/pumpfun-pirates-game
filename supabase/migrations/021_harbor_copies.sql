-- PUMPFUN PIRATES · migration 021 (v99): SHARED PvE HARBOR copies (pfp-harbor-1, -2, ...).
-- Additive only: a new seat table + 2 functions. Nothing in pvp_seats / pvp_lobby / profiles / boards is changed.
--
-- WHY A SEPARATE TABLE: pvp_lobby_load() sums every row of pvp_seats as an ARENA room (4 Hz). Harbor copies run at 1 Hz and
-- must never take a Solo / Squads arena seat away, so they live in pvp_harbor_seats and are NOT counted by pvp_lobby_load().
--
-- BUDGET (free Supabase Realtime: 100 msgs/s project-wide, every message sent OR delivered counts):
--   arena rooms (unchanged, migration 007/020): Σ n·4·(n+s) ≤ 80                         (Solo + Squads together)
--   a harbor copy with n pirates + s spectators: n·1.5·(n+s) msgs/s when n+s ≥ 2, else 0  (1 Hz state + ~0.5/s volleys;
--       a pirate alone in a copy opens no Realtime socket at all: local harbor, exactly like v98)
--   harbor total ≤ least(60, 95 − arena load). The ARENA ALWAYS WINS: pvp_lobby never looks at the harbor, and when the
--   arenas grow past the harbor's headroom every heartbeat moves the newest pirate of a shared copy into an empty copy
--   (= back to a private harbor) until the total is ≤ 95 again.
--   e.g. arenas idle: copies of 4+4 (24+24 = 48); one full arena (80): 15 left = one copy of 3 (13.5) or two of 2 (6+6).
create table if not exists public.pvp_harbor_seats (
  seat text primary key check (char_length(seat) between 12 and 40),
  prefix text not null check (char_length(prefix) between 3 and 40),
  copy int not null check (copy between 1 and 99),
  state text not null check (state in ('play', 'spec')),
  name text not null default 'PIRATE',
  joined timestamptz not null default clock_timestamp(),
  seen timestamptz not null default now()
);
create index if not exists pvp_harbor_seats_room on public.pvp_harbor_seats (prefix, copy);
alter table public.pvp_harbor_seats enable row level security; -- no policies: only the security-definer functions touch it
revoke all on public.pvp_harbor_seats from anon, authenticated;

create or replace function public.pvp_harbor_load() returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when n >= 1 and n + s >= 2 then n * 1.5 * (n + s) else 0 end), 0)
  from (select prefix, copy, count(*) filter (where state = 'play') n, count(*) filter (where state = 'spec') s from pvp_harbor_seats group by prefix, copy) t;
$$;

create or replace function public.pvp_harbor(p_seat text, p_prefix text, p_op text, p_name text default null, p_cap int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rate constant numeric := 1.5; total_max constant numeric := 95; harbor_max constant numeric := 60; max_copies constant int := 60;
  cap int; r pvp_harbor_seats; c int; n int; s int; arena numeric; hb numeric; room_load numeric; delta numeric; victim pvp_harbor_seats; free_c int;
begin
  if p_seat is null or char_length(p_seat) not between 12 and 40 or p_prefix is null or p_prefix !~ '^pfp-harbor(-[a-zA-Z0-9]{1,16})?$'
     or p_op not in ('beat', 'spec', 'peek', 'leave') then
    return jsonb_build_object('state', 'error');
  end if;
  perform pg_advisory_xact_lock(hashtext('pvp_harbor'));
  delete from pvp_harbor_seats where seen < now() - interval '20 seconds';
  cap := (case when p_prefix = 'pfp-harbor' then 4 else least(greatest(coalesce(p_cap, 4), 1), 4) end); -- tests may ask for a smaller copy
  arena := pvp_lobby_load();

  if p_op = 'leave' then
    delete from pvp_harbor_seats where seat = p_seat;
    return jsonb_build_object('state', 'left');
  end if;

  select * into r from pvp_harbor_seats where seat = p_seat;
  if found then
    update pvp_harbor_seats set seen = now(), name = coalesce(left(p_name, 20), name) where seat = p_seat;
    if r.prefix <> p_prefix or (p_op = 'beat' and r.state <> 'play') or (p_op = 'spec' and r.state <> 'spec') then
      delete from pvp_harbor_seats where seat = p_seat; r := null;
    end if;
  end if;

  if p_op = 'beat' then
    -- over budget (the arenas grew): the newest pirate of a shared copy goes to an empty copy (private harbor again)
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
    if r.seat is null then
      -- fill the lowest copy that has room AND budget; else the lowest empty copy (alone = no Realtime traffic)
      hb := pvp_harbor_load(); c := null;
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
      if c is null then
        select min(g) into c from generate_series(1, max_copies) g
          where not exists (select 1 from pvp_harbor_seats x where x.prefix = p_prefix and x.copy = g);
      end if;
      if c is null then return jsonb_build_object('state', 'full'); end if;
      insert into pvp_harbor_seats (seat, prefix, copy, state, name) values (p_seat, p_prefix, c, 'play', coalesce(left(p_name, 20), 'PIRATE'));
    end if;
  elsif p_op = 'spec' then
    if r.seat is null then
      -- the busiest copy (most pirates; lowest number on a tie), if the budget has room for one more listener
      select copy, count(*) filter (where state = 'play'), count(*) filter (where state = 'spec') into c, n, s from pvp_harbor_seats
        where prefix = p_prefix group by copy having count(*) filter (where state = 'play') > 0 order by 2 desc, copy limit 1;
      if c is null then return jsonb_build_object('state', 'empty', 'pirates', 0); end if;
      hb := pvp_harbor_load();
      delta := n * rate * (n + s + 1) - (case when n + s >= 2 then n * rate * (n + s) else 0 end);
      if arena + hb + delta > total_max or hb + delta > harbor_max then return jsonb_build_object('state', 'full', 'why', 'spectators'); end if;
      insert into pvp_harbor_seats (seat, prefix, copy, state, name) values (p_seat, p_prefix, c, 'spec', coalesce(left(p_name, 20), 'PIRATE'));
    end if;
  end if;

  select * into r from pvp_harbor_seats where seat = p_seat;
  return jsonb_build_object(
    'state', (case when p_op = 'peek' then 'peek' when r.seat is null then 'none' else r.state end),
    'copy', r.copy,
    'n', (select count(*) from pvp_harbor_seats where prefix = p_prefix and copy = r.copy and state = 'play'),
    's', (select count(*) from pvp_harbor_seats where prefix = p_prefix and copy = r.copy and state = 'spec'),
    'cap', cap,
    'pirates', (select count(*) from pvp_harbor_seats where prefix = p_prefix and state = 'play'),
    'copies', (select coalesce(jsonb_agg(jsonb_build_array(t.copy, t.k) order by t.copy), '[]'::jsonb)
               from (select h.copy, count(*) filter (where h.state = 'play') k from pvp_harbor_seats h where h.prefix = p_prefix group by h.copy) t),
    'load', round(arena + pvp_harbor_load(), 1));
end;
$$;
revoke all on function public.pvp_harbor_load() from public, anon, authenticated;
revoke all on function public.pvp_harbor(text, text, text, text, int) from public;
grant execute on function public.pvp_harbor(text, text, text, text, int) to anon, authenticated;
