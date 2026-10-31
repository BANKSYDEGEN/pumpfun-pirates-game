-- PUMPFUN PIRATES · migration 006: PvP KILLS leaderboard (ALL TIME / MONTHLY / DAILY). NEW objects only; the solo
-- Top Pirates leaderboard tables are not touched. Writes only through the `pvp` Edge Function (service role).
-- A kill is recorded only when BOTH sides report it (killer: "I sank X", victim: "X sank me") within 30 s, so one
-- client can't invent kills. Day / month boundaries: America/Indiana/Indianapolis.

create table if not exists public.pvp_players (         -- leaderboard identity: 'wallet:<pubkey>' or 'dev:<sha256 prefix of a device secret>'
  id text primary key check (id ~ '^(wallet:[1-9A-HJ-NP-Za-km-z]{32,44}|dev:[0-9a-f]{24})$'),
  name text not null default 'PIRATE' check (char_length(name) between 1 and 20),
  updated_at timestamptz not null default now()
);
create table if not exists public.pvp_net (             -- a session's network id belongs to exactly one player
  net_id text primary key check (char_length(net_id) between 6 and 20),
  player_id text not null references public.pvp_players(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists pvp_net_created_idx on public.pvp_net (created_at);
create table if not exists public.pvp_kill_claims (
  id bigserial primary key,
  room text not null, killer_net text not null, victim_net text not null, life integer not null,
  side char(1) not null check (side in ('k','v')),
  player_id text not null references public.pvp_players(id) on delete cascade,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists pvp_kill_claims_match_idx on public.pvp_kill_claims (room, killer_net, victim_net, life, side);
create index if not exists pvp_kill_claims_player_idx on public.pvp_kill_claims (player_id, created_at);
create table if not exists public.pvp_kills (
  id bigserial primary key,
  killer_id text not null references public.pvp_players(id) on delete cascade,
  victim_id text not null references public.pvp_players(id) on delete cascade,
  room text not null, killer_net text not null, victim_net text not null, life integer not null,
  created_at timestamptz not null default now(),
  unique (room, killer_net, victim_net, life),
  check (killer_id <> victim_id)
);
create index if not exists pvp_kills_created_idx on public.pvp_kills (created_at);
create index if not exists pvp_kills_killer_idx on public.pvp_kills (killer_id, created_at);
create index if not exists pvp_kills_victim_idx on public.pvp_kills (victim_id, created_at);

alter table public.pvp_players enable row level security;
alter table public.pvp_net enable row level security;
alter table public.pvp_kill_claims enable row level security;
alter table public.pvp_kills enable row level security;
revoke all on public.pvp_players, public.pvp_net, public.pvp_kill_claims, public.pvp_kills from anon, authenticated;

-- one claim; returns 'recorded' | 'pending' | a reason it was rejected. Called by the Edge Function only.
create or replace function public.pvp_claim_kill(p_player text, p_name text, p_room text, p_killer_net text, p_victim_net text, p_life integer, p_side text)
returns text language plpgsql security definer set search_path = public as $$
declare own_net text; bound text; other record; k_id text; v_id text; n int;
begin
  if p_side not in ('k','v') then return 'bad side'; end if;
  if p_killer_net = p_victim_net then return 'self kill'; end if;
  insert into pvp_players (id, name, updated_at) values (p_player, coalesce(nullif(p_name, ''), 'PIRATE'), now())
    on conflict (id) do update set name = excluded.name, updated_at = now();
  own_net := case when p_side = 'k' then p_killer_net else p_victim_net end;
  insert into pvp_net (net_id, player_id) values (own_net, p_player) on conflict (net_id) do nothing;
  select player_id into bound from pvp_net where net_id = own_net;
  if bound <> p_player then return 'net id belongs to another player'; end if;
  select count(*) into n from pvp_kill_claims where player_id = p_player and created_at > now() - interval '1 minute';
  if n >= 30 then return 'rate limited'; end if;
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
  -- no farming: the same killer on the same victim counts at most once per 2 minutes
  if exists (select 1 from pvp_kills where killer_id = k_id and victim_id = v_id and created_at > now() - interval '2 minutes') then return 'same victim too soon'; end if;
  select count(*) into n from pvp_kills where killer_id = k_id and created_at > now() - interval '1 minute';
  if n >= 6 then return 'killer rate limited'; end if;
  select count(*) into n from pvp_kills where killer_id = k_id and created_at > now() - interval '1 day';
  if n >= 600 then return 'daily cap'; end if;
  insert into pvp_kills (killer_id, victim_id, room, killer_net, victim_net, life) values (k_id, v_id, p_room, p_killer_net, p_victim_net, p_life)
    on conflict do nothing;
  return 'recorded';
end $$;
revoke all on function public.pvp_claim_kill(text, text, text, text, text, integer, text) from public, anon, authenticated;

-- top players for a period ('all' | 'month' | 'day'), America/Indiana/Indianapolis calendar boundaries. Public read.
create or replace function public.pvp_kills_top(p_period text default 'all', p_limit integer default 50)
returns table (player text, name text, kills bigint, deaths bigint) language sql stable security definer set search_path = public as $$
  with since as (
    select case p_period
      when 'day' then date_trunc('day', now() at time zone 'America/Indiana/Indianapolis') at time zone 'America/Indiana/Indianapolis'
      when 'month' then date_trunc('month', now() at time zone 'America/Indiana/Indianapolis') at time zone 'America/Indiana/Indianapolis'
      else '-infinity'::timestamptz end as t
  ), k as (
    select killer_id as id, count(*) as kills from pvp_kills, since where created_at >= since.t group by killer_id
  ), d as (
    select victim_id as id, count(*) as deaths from pvp_kills, since where created_at >= since.t group by victim_id
  )
  select case when k.id like 'wallet:%' then 'w:' || substr(k.id, 8, 4) || '…' || right(k.id, 4) else 'd:' || substr(k.id, 5, 6) end,
         p.name, k.kills, coalesce(d.deaths, 0)
  from k join pvp_players p on p.id = k.id left join d on d.id = k.id
  order by k.kills desc, coalesce(d.deaths, 0) asc, p.updated_at asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;
grant execute on function public.pvp_kills_top(text, integer) to anon, authenticated;

-- housekeeping helper (run from the Edge Function occasionally): stale claims / net ids
create or replace function public.pvp_kills_gc() returns void language sql security definer set search_path = public as $$
  delete from pvp_kill_claims where created_at < now() - interval '10 minutes';
  delete from pvp_net where created_at < now() - interval '2 days';
$$;
revoke all on function public.pvp_kills_gc() from public, anon, authenticated;
