-- PUMPFUN PIRATES · migration 054 (BANKSY t1851u: "Make it so you can add friends and have friend list and auto join their server if possible").
-- FRIENDS: requests (accept / decline / cancel), friendships (unfriend), and a per-player presence heartbeat (which Harbor server /
-- Arena the pirate is in) that ONLY accepted friends can read. Identity = the pvp Edge Function's resolved player id (whoAmI: signed
-- wallet session, else device key, through pvp_main) — never a client-typed id. Everything below is service-role only: tables have RLS on
-- with no policies + revoke from anon/authenticated, and the definer functions are revoked from public/anon/authenticated.
-- ADDITIVE ONLY: 3 new tables + 2 new functions. Nothing existing is altered.
begin;

create table if not exists public.pvp_friend_reqs (
  from_id text not null references public.pvp_players(id) on delete cascade,
  to_id   text not null references public.pvp_players(id) on delete cascade,
  created timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index if not exists pvp_friend_reqs_to on public.pvp_friend_reqs (to_id);

-- one row per friendship, a < b (so a pair can never be stored twice)
create table if not exists public.pvp_friends (
  a text not null references public.pvp_players(id) on delete cascade,
  b text not null references public.pvp_players(id) on delete cascade,
  created timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
create index if not exists pvp_friends_b on public.pvp_friends (b);

-- where a pirate is right now (their own client reports it through the signed pvp call; fresh = seen in the last 75 s)
create table if not exists public.pvp_friend_presence (
  player_id text primary key,
  w text not null check (w in ('harbor', 'arena', 'queue', 'spec', 'solo')),
  prefix text,
  copy int,
  mode text,
  seen timestamptz not null default now()
);

alter table public.pvp_friend_reqs enable row level security;
alter table public.pvp_friends enable row level security;
alter table public.pvp_friend_presence enable row level security;
revoke all on public.pvp_friend_reqs, public.pvp_friends, public.pvp_friend_presence from anon, authenticated;

-- p_op: request | respond | cancel | remove | list | search. Names resolve case-insensitively to exactly ONE registered pirate.
create or replace function public.pvp_friend_op(p_player text, p_op text, p_name text default null, p_accept boolean default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  max_friends constant int := 100; max_out constant int := 30; max_in constant int := 50; fresh constant interval := interval '75 seconds';
  me text := p_player; my_name text; tgt text; tgt_name text; n int; q text; lo text; hi text;
begin
  if me is null or char_length(me) not between 5 and 80 then return jsonb_build_object('ok', false, 'why', 'no identity'); end if;
  select name into my_name from pvp_players where id = me;
  if p_op = 'list' then
    return jsonb_build_object('ok', true, 'me', coalesce(my_name, ''),
      'friends', coalesce((select jsonb_agg(jsonb_build_object(
          'n', p.name,
          'on', (fp.seen is not null and fp.seen > now() - fresh),
          'w', case when fp.seen > now() - fresh then fp.w else 'off' end,
          'prefix', case when fp.seen > now() - fresh and fp.w = 'harbor' then fp.prefix end,
          'copy', case when fp.seen > now() - fresh and fp.w = 'harbor' then fp.copy end,
          'mode', case when fp.seen > now() - fresh then fp.mode end,
          'room_n', case when fp.seen > now() - fresh and fp.w = 'harbor' then (select count(*) from pvp_harbor_seats h where h.prefix = fp.prefix and h.copy = fp.copy and h.state = 'play') end
        ) order by (fp.seen is not null and fp.seen > now() - fresh) desc, lower(p.name))
        from (select case when f.a = me then f.b else f.a end as fid from pvp_friends f where f.a = me or f.b = me) x
        join pvp_players p on p.id = x.fid left join pvp_friend_presence fp on fp.player_id = x.fid), '[]'::jsonb),
      'incoming', coalesce((select jsonb_agg(p.name order by r.created desc) from pvp_friend_reqs r join pvp_players p on p.id = r.from_id where r.to_id = me), '[]'::jsonb),
      'outgoing', coalesce((select jsonb_agg(p.name order by r.created desc) from pvp_friend_reqs r join pvp_players p on p.id = r.to_id where r.from_id = me), '[]'::jsonb));
  end if;
  if my_name is null then return jsonb_build_object('ok', false, 'why', 'pick a pirate name first'); end if;
  if p_op = 'search' then
    q := lower(btrim(coalesce(p_name, '')));
    if char_length(q) < 2 then return jsonb_build_object('ok', true, 'players', '[]'::jsonb); end if;
    q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
    return jsonb_build_object('ok', true, 'players', coalesce((select jsonb_agg(jsonb_build_object('n', t.name, 's', t.s) order by t.exact desc, lower(t.name)) from (
      select p.name, (lower(p.name) = lower(btrim(p_name))) as exact,
        case when exists (select 1 from pvp_friends f where (f.a = least(me, p.id) and f.b = greatest(me, p.id))) then 'friend'
             when exists (select 1 from pvp_friend_reqs r where r.from_id = me and r.to_id = p.id) then 'sent'
             when exists (select 1 from pvp_friend_reqs r where r.from_id = p.id and r.to_id = me) then 'incoming' else '' end as s
      from pvp_players p where p.id <> me and lower(p.name) like q || '%' escape '\' and upper(btrim(p.name)) <> 'PIRATE'
      order by (lower(p.name) = lower(btrim(p_name))) desc, lower(p.name) limit 8) t), '[]'::jsonb));
  end if;
  if p_op not in ('request', 'respond', 'cancel', 'remove') then return jsonb_build_object('ok', false, 'why', 'unknown'); end if;
  -- the other pirate: exactly one registered name (015 keeps names unique, case-insensitively)
  select count(*), min(id), min(name) into n, tgt, tgt_name from pvp_players where lower(btrim(name)) = lower(btrim(coalesce(p_name, ''))) and upper(btrim(name)) <> 'PIRATE';
  if n <> 1 then return jsonb_build_object('ok', false, 'why', 'pirate not found'); end if;
  if tgt = me then return jsonb_build_object('ok', false, 'why', 'that is you'); end if;
  lo := least(me, tgt); hi := greatest(me, tgt);
  perform pg_advisory_xact_lock(hashtext('pvp_friend:' || lo || '|' || hi));

  if p_op = 'request' then
    if exists (select 1 from pvp_friends where a = lo and b = hi) then return jsonb_build_object('ok', true, 'state', 'friends', 'name', tgt_name); end if;
    if exists (select 1 from pvp_friend_reqs where from_id = tgt and to_id = me) then -- they already asked you: that's a yes
      if (select count(*) from pvp_friends where a = me or b = me) >= max_friends then return jsonb_build_object('ok', false, 'why', 'friend list full'); end if;
      delete from pvp_friend_reqs where (from_id = tgt and to_id = me) or (from_id = me and to_id = tgt);
      insert into pvp_friends (a, b) values (lo, hi) on conflict do nothing;
      return jsonb_build_object('ok', true, 'state', 'friends', 'name', tgt_name);
    end if;
    if exists (select 1 from pvp_friend_reqs where from_id = me and to_id = tgt) then return jsonb_build_object('ok', true, 'state', 'sent', 'name', tgt_name); end if;
    if (select count(*) from pvp_friends where a = me or b = me) >= max_friends then return jsonb_build_object('ok', false, 'why', 'friend list full'); end if;
    if (select count(*) from pvp_friend_reqs where from_id = me) >= max_out then return jsonb_build_object('ok', false, 'why', 'too many pending requests'); end if;
    if (select count(*) from pvp_friend_reqs where to_id = tgt) >= max_in then return jsonb_build_object('ok', false, 'why', 'their request box is full'); end if;
    insert into pvp_friend_reqs (from_id, to_id) values (me, tgt);
    return jsonb_build_object('ok', true, 'state', 'sent', 'name', tgt_name);
  elsif p_op = 'respond' then
    if not exists (select 1 from pvp_friend_reqs where from_id = tgt and to_id = me) then return jsonb_build_object('ok', false, 'why', 'no request from them'); end if;
    delete from pvp_friend_reqs where from_id = tgt and to_id = me;
    if coalesce(p_accept, false) then
      if (select count(*) from pvp_friends where a = me or b = me) >= max_friends then return jsonb_build_object('ok', false, 'why', 'friend list full'); end if;
      delete from pvp_friend_reqs where from_id = me and to_id = tgt;
      insert into pvp_friends (a, b) values (lo, hi) on conflict do nothing;
      return jsonb_build_object('ok', true, 'state', 'friends', 'name', tgt_name);
    end if;
    return jsonb_build_object('ok', true, 'state', 'declined', 'name', tgt_name);
  elsif p_op = 'cancel' then
    delete from pvp_friend_reqs where from_id = me and to_id = tgt;
    return jsonb_build_object('ok', true, 'state', 'none', 'name', tgt_name);
  else -- remove: unfriend (+ any request either way)
    delete from pvp_friends where a = lo and b = hi;
    delete from pvp_friend_reqs where (from_id = tgt and to_id = me) or (from_id = me and to_id = tgt);
    return jsonb_build_object('ok', true, 'state', 'none', 'name', tgt_name);
  end if;
end $$;
revoke all on function public.pvp_friend_op(text, text, text, boolean) from public, anon, authenticated;

-- my own presence (the Edge Function validates every field first); p_w null = just read nothing, 'off' = gone (tab closed)
create or replace function public.pvp_friend_seen(p_player text, p_w text, p_prefix text default null, p_copy int default null, p_mode text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_player is null or char_length(p_player) not between 5 and 80 then return; end if;
  if p_w = 'off' then delete from pvp_friend_presence where player_id = p_player; return; end if;
  if p_w not in ('harbor', 'arena', 'queue', 'spec', 'solo') then return; end if;
  if p_prefix is not null and p_prefix !~ '^pfp-harbor(-[a-z0-9]{2,12})?$' then p_prefix := null; end if;
  insert into pvp_friend_presence (player_id, w, prefix, copy, mode, seen)
    values (p_player, p_w, case when p_w = 'harbor' then p_prefix end, case when p_w = 'harbor' then least(greatest(coalesce(p_copy, 0), 0), 60) end,
            case when p_mode in ('solo', 'squads') then p_mode end, now())
    on conflict (player_id) do update set w = excluded.w, prefix = excluded.prefix, copy = excluded.copy, mode = excluded.mode, seen = now();
  if random() < 0.01 then delete from pvp_friend_presence where seen < now() - interval '1 day'; end if;
end $$;
revoke all on function public.pvp_friend_seen(text, text, text, int, text) from public, anon, authenticated;

commit;

-- ROLLBACK:
-- begin; drop function if exists public.pvp_friend_op(text, text, text, boolean); drop function if exists public.pvp_friend_seen(text, text, text, int, text);
--   drop table if exists public.pvp_friend_presence; drop table if exists public.pvp_friends; drop table if exists public.pvp_friend_reqs; commit;
