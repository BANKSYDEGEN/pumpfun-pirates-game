-- PUMPFUN PIRATES · migration 041 (squad-hall): cross-world squad invites + optional harbor copy preference.
-- Additive only: new invite table + extend pvp_harbor_core / pvp_harbor with p_want_copy. No boards / scores / gold touched.
-- Live shape (028): pvp_harbor = rate-limit wrapper → pvp_harbor_core = the 021 seating logic.

create table if not exists public.pvp_squad_invites (
  from_name text not null check (char_length(from_name) between 1 and 20),
  to_name   text not null check (char_length(to_name) between 1 and 20),
  code      text not null check (code ~ '^[A-Z0-9]{5}$'),
  world     text not null default '' check (char_length(world) <= 40),
  created   timestamptz not null default now(),
  primary key (from_name, to_name)
);
create index if not exists pvp_squad_invites_to on public.pvp_squad_invites (to_name, created desc);
alter table public.pvp_squad_invites enable row level security;
revoke all on public.pvp_squad_invites from anon, authenticated;

-- Core seating (was 021, renamed by 028). Recreate with optional preferred copy.
drop function if exists public.pvp_harbor_core(text, text, text, text, int);
drop function if exists public.pvp_harbor_core(text, text, text, text, int, int);

create or replace function public.pvp_harbor_core(p_seat text, p_prefix text, p_op text, p_name text default null, p_cap int default null, p_want_copy int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rate constant numeric := 1.5; total_max constant numeric := 95; harbor_max constant numeric := 60; max_copies constant int := 60;
  cap int; r pvp_harbor_seats; c int; n int; s int; arena numeric; hb numeric; room_load numeric; delta numeric; victim pvp_harbor_seats; free_c int;
  want int;
begin
  if p_seat is null or char_length(p_seat) not between 12 and 40 or p_prefix is null or p_prefix !~ '^pfp-harbor(-[a-zA-Z0-9]{1,16})?$'
     or p_op not in ('beat', 'spec', 'peek', 'leave') then
    return jsonb_build_object('state', 'error');
  end if;
  perform pg_advisory_xact_lock(hashtext('pvp_harbor'));
  delete from pvp_harbor_seats where seen < now() - interval '20 seconds';
  cap := (case when p_prefix = 'pfp-harbor' then 4 else least(greatest(coalesce(p_cap, 4), 1), 4) end);
  arena := pvp_lobby_load();
  want := case when p_want_copy is not null and p_want_copy between 1 and 99 then p_want_copy else null end;

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
      hb := pvp_harbor_load(); c := null;
      -- preferred copy (Squad Hall JOIN WORLD): only if occupied, under cap, and budget allows
      if want is not null then
        select count(*) filter (where state = 'play'), count(*) filter (where state = 'spec') into n, s
          from pvp_harbor_seats where prefix = p_prefix and copy = want;
        n := coalesce(n, 0); s := coalesce(s, 0);
        if n >= 1 and n < cap then
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
    end if;
  elsif p_op = 'spec' then
    if r.seat is null then
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
revoke all on function public.pvp_harbor_core(text, text, text, text, int, int) from public, anon, authenticated;

-- Rate-limit wrapper (028): same limits, now forwards p_want_copy.
drop function if exists public.pvp_harbor(text, text, text, text, int);
drop function if exists public.pvp_harbor(text, text, text, text, int, int);

create or replace function public.pvp_harbor(p_seat text, p_prefix text, p_op text, p_name text default null, p_cap int default null, p_want_copy int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ip text := pvp_req_ip();
begin
  if not pvp_rl_hit('hi:' || ip, 60, 600) then return jsonb_build_object('state', 'error', 'why', 'rate'); end if;
  if p_seat is not null and not pvp_rl_hit('hs:' || left(p_seat, 40), 60, 60) then return jsonb_build_object('state', 'error', 'why', 'rate'); end if;
  if p_op in ('beat', 'spec') and not exists (select 1 from pvp_harbor_seats where seat = p_seat)
     and not pvp_rl_hit('hj:' || ip, 600, 30) then return jsonb_build_object('state', 'full', 'why', 'rate'); end if;
  return pvp_harbor_core(p_seat, p_prefix, p_op, p_name, p_cap, p_want_copy);
end $$;
revoke all on function public.pvp_harbor(text, text, text, text, int, int) from public;
grant execute on function public.pvp_harbor(text, text, text, text, int, int) to anon, authenticated;
