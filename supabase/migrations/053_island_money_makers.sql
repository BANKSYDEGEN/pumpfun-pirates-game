-- PUMPFUN PIRATES · migration 053 (post/island-money-makers, pfp-v349): BANKSY t203u/t204u "How else could they make money on island?" ->
-- "Add the first 5": 1 WANTED & BOUNTY BOARDS · 2 COLISEUM PRIZE FIGHTS + RINGSIDE BETTING + SKELETON HORDE · 3 SMUGGLER CRATE RUNS ·
-- 4 SHIPWRECK DIVING + SHORE CRAB POTS + DEAD MAN'S CAVE MINING · 5 COTTAGE SPICE PLOTS + COPPER RUM STILLS (+ HARBOR RUM EXPORT STALL).
-- ADDITIVE ONLY: new tables + new functions + one new flag. No existing table, column, row or function is altered.
-- Gold rule (Emerly, 052_fix_casino_gold.sql): every island payout / stake moves the pirate's REAL server balance in ONE place,
-- pvp_isl_move(): wallet -> pvp_profiles, device -> pvp_dev_profiles (+ shop_rev on a debit, like pvp_casino_debit), the OWNER -> his
-- shared pot pvp_group_saves (main = pvp_inv_owner()) where BOTH gold AND save.gold are written (save only when that column exists),
-- and every reply carries gold (+ rev + owner) so the client re-bases (js/pvp.js serverGold) and no later save overwrites it.
-- Security: definer functions, service role only (revoked from public / anon / authenticated), flag 'island_gold', (req) idempotency on
-- every gold move, per-day caps (America/Indiana/Indianapolis), rate limits (pvp_rl_hit), server-rolled loot, server timers.
-- [review fixes, Emerly pre-push] 1 a req id is bound to player + kind + ref + delta (pvp_isl_replay), a duel accept retry never re-opens a fight;
-- 2 every RPC takes the pirate's lock FIRST (pvp_isl_lock) and one-time payouts are backed by unique indexes; 3 a prize fight is decided only by
-- the loser's own client conceding or a both-sides-confirmed pvp_kills row (pvp_claim_kill), else it refunds when it expires;
-- 4 a bounty is paid only against a confirmed pvp_kills row of that pirate, consumed once (pvp_isl_kill_used).
begin;

insert into public.pvp_flags (k, on_, note) values ('island_gold', true, 'island money-makers: bounties, coliseum, crates, gathering, cottage rum (053)')
  on conflict (k) do nothing;

-- ---------- the ledger: one row per gold move (idempotency + daily caps + "credits landed while you were away") ----------
create table if not exists public.pvp_isl_ledger (
  id         bigserial primary key,
  player_id  text not null,
  req        text not null unique check (char_length(req) between 8 and 80),
  kind       text not null check (kind ~ '^[a-z_]{2,24}$'),
  ref        text,
  delta      integer not null,
  gold_after integer not null,
  rev        integer not null default 0,
  day        date not null default ((now() at time zone 'America/Indiana/Indianapolis')::date),
  created_at timestamptz not null default now()
);
create index if not exists pvp_isl_ledger_pkd_idx on public.pvp_isl_ledger (player_id, kind, day);
create index if not exists pvp_isl_ledger_ref_idx on public.pvp_isl_ledger (player_id, kind, ref);

create or replace function public.pvp_isl_today() returns date language sql stable as $$ select (now() at time zone 'America/Indiana/Indianapolis')::date $$;
-- [review fix 2] one-time payouts are unique in the table itself (a second insert fails even if a check were ever skipped)
create unique index if not exists pvp_isl_ledger_once_idx on public.pvp_isl_ledger (player_id, kind, ref)
  where kind in ('horde', 'crate', 'duel_stake', 'duel_win', 'duel_refund', 'bet', 'bet_win', 'bet_refund');
create unique index if not exists pvp_isl_ledger_contract_idx on public.pvp_isl_ledger (player_id, ref, day) where kind = 'contract';
-- [review fix 4] a confirmed kill (pvp_kills.id) pays at most one bounty
create table if not exists public.pvp_isl_kill_used (
  kill_id    bigint primary key,
  player_id  text not null,
  req        text not null,
  used_for   text not null,
  created_at timestamptz not null default now()
);
alter table public.pvp_isl_kill_used enable row level security;
revoke all on public.pvp_isl_kill_used from public, anon, authenticated;

-- [review fix 2] ONE lock per pirate, taken FIRST by every island RPC: daily caps, one-time checks and the balance are all read under it,
-- so two concurrent calls for the same pirate run one after the other and the second sees the first's ledger row.
create or replace function public.pvp_isl_lock(p_pid text) returns void language plpgsql security definer set search_path = public as $$
begin perform pg_advisory_xact_lock(hashtextextended('pvp_isl:' || coalesce(p_pid, ''), 0)); end $$;
revoke all on function public.pvp_isl_lock(text) from public, anon, authenticated;

-- [review fix 1] a request id is bound to ONE operation: the same pirate + kind + ref (+ delta whenever the caller can compute it).
-- null = a new request; ok + retry = the first reply again; anything else = 'request id reused' (never a second operation on an old req).
create or replace function public.pvp_isl_replay(p_pid text, p_req text, p_kind text, p_ref text, p_delta integer default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare prev pvp_isl_ledger;
begin
  select * into prev from pvp_isl_ledger where req = p_req;
  if not found then return null; end if;
  if prev.player_id <> p_pid or prev.kind <> p_kind or prev.ref is distinct from p_ref or (p_delta is not null and prev.delta <> p_delta) then
    return jsonb_build_object('ok', false, 'why', 'request id reused'); end if;
  return jsonb_build_object('ok', true, 'gold', prev.gold_after, 'delta', prev.delta, 'rev', prev.rev, 'owner', p_pid = public.pvp_inv_owner(), 'retry', true);
end $$;
revoke all on function public.pvp_isl_replay(text, text, text, text, integer) from public, anon, authenticated;

-- the owner's shared pot also keeps a save jsonb on some deployments: keep save.gold == gold (052 rule) whenever that column exists
create or replace function public.pvp_isl_save_sync(p_main text, p_gold integer) returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pvp_group_saves' and column_name = 'save') then
    execute 'update public.pvp_group_saves set save = jsonb_set(coalesce(save, ''{}''::jsonb), ''{gold}'', to_jsonb($1), true) where main = $2' using p_gold, p_main;
  end if;
end $$;
revoke all on function public.pvp_isl_save_sync(text, integer) from public, anon, authenticated;

-- THE gold move. p_delta > 0 = credit (p_cap = this kind's gold cap today, null = none), < 0 = debit (never below 0).
create or replace function public.pvp_isl_move(p_player text, p_delta integer, p_req text, p_kind text, p_ref text default null, p_cap integer default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); g integer; rv integer := 0; rp jsonb; used integer;
  is_wallet boolean := pid like 'wallet:%'; is_owner boolean := pid = public.pvp_inv_owner();
  d integer := greatest(-10000000, least(10000000, coalesce(p_delta, 0)));
begin
  if p_req is null or char_length(p_req) not between 8 and 80 or p_kind is null then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
  perform public.pvp_isl_lock(pid);                                   -- [review fix 2] lock first, then replay / cap / balance
  rp := public.pvp_isl_replay(pid, p_req, p_kind, p_ref, d);          -- [review fix 1] same pirate + kind + ref + delta, else rejected
  if rp is not null then return rp; end if;
  if d > 0 and p_cap is not null then
    select coalesce(sum(delta), 0) into used from pvp_isl_ledger where player_id = pid and kind = p_kind and day = pvp_isl_today() and delta > 0;
    if used + d > p_cap then return jsonb_build_object('ok', false, 'why', 'daily cap', 'cap', p_cap, 'used', used); end if;
  end if;
  begin   -- [review fix 2] a unique one-time row that already exists rolls this whole move back (savepoint), never a double pay
  if is_owner then
    insert into pvp_group_saves (main) values (pid) on conflict (main) do nothing;
    select gold into g from pvp_group_saves where main = pid for update;
    g := coalesce(g, 0);
    if g + d < 0 then return jsonb_build_object('ok', false, 'why', 'not enough gold', 'gold', g, 'owner', true); end if;
    g := least(10000000, g + d);
    update pvp_group_saves set gold = g, updated_at = now() where main = pid;
    perform pvp_isl_save_sync(pid, g);
  else
    if is_wallet then select gold, shop_rev into g, rv from pvp_profiles where id = pid for update;
    else select gold, shop_rev into g, rv from pvp_dev_profiles where id = pid for update; end if;
    if not found then return jsonb_build_object('ok', false, 'why', 'no save yet'); end if;
    g := coalesce(g, 0); rv := coalesce(rv, 0);
    if g + d < 0 then return jsonb_build_object('ok', false, 'why', 'not enough gold', 'gold', g, 'owner', false); end if;
    g := least(10000000, g + d);
    if d < 0 then rv := rv + 1; end if;   -- a debit bumps the shop rev (pvp_casino_debit); the reply's rev re-bases the next save
    if is_wallet then update pvp_profiles set gold = g, shop_rev = rv where id = pid;
    else update pvp_dev_profiles set gold = g, shop_rev = rv where id = pid; end if;
  end if;
  insert into pvp_isl_ledger (player_id, req, kind, ref, delta, gold_after, rev) values (pid, p_req, p_kind, p_ref, d, g, rv);
  exception when unique_violation then return jsonb_build_object('ok', false, 'why', 'already paid');
  end;
  return jsonb_build_object('ok', true, 'gold', g, 'delta', d, 'rev', rv, 'owner', is_owner);
end $$;
revoke all on function public.pvp_isl_move(text, integer, text, text, text, integer) from public, anon, authenticated;

-- ---------- 1. WANTED & BOUNTY BOARDS ----------
create table if not exists public.pvp_isl_bounties (
  target_key  text primary key check (char_length(target_key) between 1 and 20),
  target_name text not null check (char_length(target_name) between 1 and 20),
  pot         integer not null default 0 check (pot >= 0 and pot <= 50000),
  posts       integer not null default 0,
  updated_at  timestamptz not null default now()
);
create table if not exists public.pvp_isl_bounty_log (
  id bigserial primary key, target_key text not null, actor_id text not null, actor_name text, amount integer not null,
  kind text not null check (kind in ('post', 'claim')), created_at timestamptz not null default now()
);
create index if not exists pvp_isl_bounty_log_idx on public.pvp_isl_bounty_log (kind, created_at);

create or replace function public.pvp_isl_key(p_name text) returns text language sql immutable as $$
  select left(regexp_replace(lower(btrim(coalesce(p_name, ''))), '\s+', ' ', 'g'), 20) $$;

-- daily contracts: server payout table, one claim per contract per day
create or replace function public.pvp_isl_contract(p_player text, p_contract text, p_req text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); pay integer; rp jsonb;
begin
  if not pvp_flag('island_gold') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  perform public.pvp_isl_lock(pid);   -- [review fix 2] this pirate's lock FIRST: caps, one-time checks + balance below run under it
  pay := case p_contract when 'cave_raiders' then 150 when 'jungle_stalkers' then 120 when 'cursed_captains' then 250 when 'salvage_patrol' then 100 else 0 end;
  if pay = 0 then return jsonb_build_object('ok', false, 'why', 'bad contract'); end if;
  rp := public.pvp_isl_replay(pid, p_req, 'contract', p_contract, pay); if rp is not null then return rp || jsonb_build_object('contract', p_contract, 'paid', pay); end if;
  if exists (select 1 from pvp_isl_ledger where player_id = pid and kind = 'contract' and ref = p_contract and day = pvp_isl_today() and req <> p_req) then
    return jsonb_build_object('ok', false, 'why', 'claimed today'); end if;
  if not pvp_rl_hit('islc:' || pid, 60, 10) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  return public.pvp_isl_move(p_player, pay, p_req, 'contract', p_contract, 620) || jsonb_build_object('contract', p_contract, 'paid', pay);
end $$;
revoke all on function public.pvp_isl_contract(text, text, text) from public, anon, authenticated;

create or replace function public.pvp_isl_bounty_post(p_player text, p_name text, p_target text, p_amount integer, p_req text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); tk text := public.pvp_isl_key(p_target); amt integer := coalesce(p_amount, 0); cur integer; mv jsonb;
begin
  if not pvp_flag('island_gold') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  perform public.pvp_isl_lock(pid);   -- [review fix 2] this pirate's lock FIRST: caps, one-time checks + balance below run under it
  if tk = '' or tk = public.pvp_isl_key(p_name) then return jsonb_build_object('ok', false, 'why', 'pick another pirate'); end if;
  if amt < 100 or amt > 5000 then return jsonb_build_object('ok', false, 'why', 'stake 100 to 5000'); end if;
  if not pvp_rl_hit('islbp:' || pid, 60, 8) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  select pot into cur from pvp_isl_bounties where target_key = tk for update;
  if coalesce(cur, 0) + amt > 50000 then return jsonb_build_object('ok', false, 'why', 'pot is full'); end if;
  mv := public.pvp_isl_move(p_player, -amt, p_req, 'bounty_post', tk);
  if not coalesce((mv->>'ok')::boolean, false) then return mv; end if;
  if coalesce((mv->>'retry')::boolean, false) then return mv || jsonb_build_object('pot', coalesce(cur, 0)); end if;
  insert into pvp_isl_bounties (target_key, target_name, pot, posts) values (tk, left(btrim(p_target), 20), amt, 1)
    on conflict (target_key) do update set pot = least(50000, pvp_isl_bounties.pot + amt), posts = pvp_isl_bounties.posts + 1, updated_at = now();
  insert into pvp_isl_bounty_log (target_key, actor_id, actor_name, amount, kind) values (tk, pid, left(coalesce(p_name, ''), 20), amt, 'post');
  return mv || jsonb_build_object('pot', coalesce(cur, 0) + amt, 'target', tk);
end $$;
revoke all on function public.pvp_isl_bounty_post(text, text, text, integer, text) from public, anon, authenticated;

-- the killer claims the whole pot on that name (never on himself; the Edge Function also drops squadmates + Safe Zone KOs client-side)
create or replace function public.pvp_isl_bounty_claim(p_player text, p_name text, p_target text, p_req text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); tk text := public.pvp_isl_key(p_target); b pvp_isl_bounties; mv jsonb; rp jsonb; kid bigint;
begin
  if not pvp_flag('island_gold') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  perform public.pvp_isl_lock(pid);   -- [review fix 2] this pirate's lock FIRST: caps, one-time checks + balance below run under it
  rp := public.pvp_isl_replay(pid, p_req, 'bounty_claim', tk);           -- [review fix 1] retry = the first reply; another op on this req = rejected
  if rp is not null then return rp || jsonb_build_object('claimed', 0, 'target', tk); end if;
  if tk = '' or tk = public.pvp_isl_key(p_name) then return jsonb_build_object('ok', false, 'why', 'not on yourself'); end if;
  if not pvp_rl_hit('islbc:' || pid, 3600, 60) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  select * into b from pvp_isl_bounties where target_key = tk for update;
  if not found or b.pot <= 0 then return jsonb_build_object('ok', false, 'why', 'no bounty'); end if;
  -- [review fix 4] only a CONFIRMED kill pays: a pvp_kills row (both pirates reported it and pvp_claim_kill checked seats, networks, links and
  -- rate limits) where YOU are the killer and the victim goes by the wanted name, from the last 15 minutes, never used for a bounty before.
  select k.id into kid from pvp_kills k join pvp_players pl on pl.id = k.victim_id
    where k.killer_id = pid and k.victim_id <> pid and k.created_at > now() - interval '15 minutes' and public.pvp_isl_key(pl.name) = tk
      and not exists (select 1 from pvp_isl_kill_used u where u.kill_id = k.id)
    order by k.id desc limit 1;
  if kid is null then return jsonb_build_object('ok', false, 'why', 'no confirmed kill', 'pending', true); end if;
  insert into pvp_isl_kill_used (kill_id, player_id, req, used_for) values (kid, pid, p_req, 'bounty:' || tk);   -- consumed once (primary key)
  mv := public.pvp_isl_move(p_player, b.pot, p_req, 'bounty_claim', tk);
  if not coalesce((mv->>'ok')::boolean, false) then delete from pvp_isl_kill_used where kill_id = kid; return mv; end if;
  delete from pvp_isl_bounties where target_key = tk;
  insert into pvp_isl_bounty_log (target_key, actor_id, actor_name, amount, kind) values (tk, pid, left(coalesce(p_name, ''), 20), b.pot, 'claim');
  return mv || jsonb_build_object('claimed', b.pot, 'target', b.target_name, 'kill', kid);
end $$;
revoke all on function public.pvp_isl_bounty_claim(text, text, text, text) from public, anon, authenticated;

-- ---------- 2. COLISEUM PRIZE FIGHTS + RINGSIDE BETTING + SKELETON HORDE ----------
create table if not exists public.pvp_isl_duels (
  id         uuid primary key default gen_random_uuid(),
  red_id     text not null, red_name text not null,
  blue_id    text, blue_name text,
  stake      integer not null check (stake in (100, 250, 500, 1000)),
  status     text not null default 'open' check (status in ('open', 'live', 'done', 'cancelled')),
  winner     char(1) check (winner in ('r', 'b')),
  win_claim  char(1) check (win_claim in ('r', 'b')), win_claim_at timestamptz,   -- [review fix 3] an unconfirmed 'won' report (never pays by itself)
  created_at timestamptz not null default now(), started_at timestamptz, settled_at timestamptz
);
create index if not exists pvp_isl_duels_status_idx on public.pvp_isl_duels (status, created_at);
create table if not exists public.pvp_isl_bets (
  id         bigserial primary key,
  duel_id    uuid not null references public.pvp_isl_duels(id) on delete cascade,
  player_id  text not null, player_name text,
  side       char(1) not null check (side in ('r', 'b')),
  amount     integer not null check (amount between 50 and 500),
  payout     integer,
  created_at timestamptz not null default now(),
  unique (duel_id, player_id)
);

create or replace function public.pvp_isl_duel_post(p_player text, p_name text, p_stake integer, p_req text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); mv jsonb; did uuid; pref text;
begin
  if not pvp_flag('island_gold') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  perform public.pvp_isl_lock(pid);   -- [review fix 2] this pirate's lock FIRST: caps, one-time checks + balance below run under it
  if p_stake is null or p_stake not in (100, 250, 500, 1000) then return jsonb_build_object('ok', false, 'why', 'bad stake'); end if;
  -- [review fix 1] a retry of THIS post (same pirate, same stake, its own fight) = the first reply; any other reuse of the req is rejected
  select ref into pref from pvp_isl_ledger where req = p_req;
  if found then
    mv := public.pvp_isl_replay(pid, p_req, 'duel_stake', pref, -p_stake);
    if coalesce((mv->>'ok')::boolean, false) and exists (select 1 from pvp_isl_duels where id::text = pref and red_id = pid) then
      return mv || jsonb_build_object('duel', pref, 'side', 'r', 'stake', p_stake); end if;
    return jsonb_build_object('ok', false, 'why', 'request id reused');
  end if;
  if exists (select 1 from pvp_isl_duels where (red_id = pid or blue_id = pid) and status in ('open', 'live') and created_at > now() - interval '15 minutes') then
    return jsonb_build_object('ok', false, 'why', 'you already have a fight posted'); end if;
  if not pvp_rl_hit('isld:' || pid, 60, 6) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  did := gen_random_uuid();
  mv := public.pvp_isl_move(p_player, -p_stake, p_req, 'duel_stake', did::text);
  if not coalesce((mv->>'ok')::boolean, false) then return mv; end if;
  if coalesce((mv->>'retry')::boolean, false) then return jsonb_build_object('ok', false, 'why', 'request id reused'); end if;
  insert into pvp_isl_duels (id, red_id, red_name, stake) values (did, pid, left(coalesce(nullif(btrim(p_name), ''), 'PIRATE'), 20), p_stake);
  return mv || jsonb_build_object('duel', did, 'side', 'r', 'stake', p_stake);
end $$;
revoke all on function public.pvp_isl_duel_post(text, text, integer, text) from public, anon, authenticated;

create or replace function public.pvp_isl_duel_accept(p_player text, p_name text, p_duel uuid, p_req text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); d pvp_isl_duels; mv jsonb;
begin
  if not pvp_flag('island_gold') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  perform public.pvp_isl_lock(pid);   -- [review fix 2] this pirate's lock FIRST: caps, one-time checks + balance below run under it
  select * into d from pvp_isl_duels where id = p_duel for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'that fight is gone'); end if;
  -- [review fix 1] a retry only answers again when THIS pirate's stake for THIS fight is on the ledger AND he is its blue corner; it never
  -- changes the fight (no second 'live', no stake-free accept). Any other reuse of the req is rejected.
  mv := public.pvp_isl_replay(pid, p_req, 'duel_stake', d.id::text, -d.stake);
  if mv is not null then
    if coalesce((mv->>'ok')::boolean, false) and d.blue_id = pid then return mv || jsonb_build_object('duel', d.id, 'side', 'b', 'stake', d.stake, 'red', d.red_name); end if;
    return jsonb_build_object('ok', false, 'why', 'request id reused');
  end if;
  if d.status <> 'open' or d.created_at < now() - interval '5 minutes' then return jsonb_build_object('ok', false, 'why', 'that fight is gone'); end if;
  if d.red_id = pid then return jsonb_build_object('ok', false, 'why', 'not against yourself'); end if;
  if exists (select 1 from pvp_isl_bets where duel_id = d.id and player_id = pid) then return jsonb_build_object('ok', false, 'why', 'you bet on this fight'); end if;
  mv := public.pvp_isl_move(p_player, -d.stake, p_req, 'duel_stake', d.id::text);
  if not coalesce((mv->>'ok')::boolean, false) then return mv; end if;
  if coalesce((mv->>'retry')::boolean, false) then return jsonb_build_object('ok', false, 'why', 'request id reused'); end if;   -- never live without a fresh stake
  update pvp_isl_duels set blue_id = pid, blue_name = left(coalesce(nullif(btrim(p_name), ''), 'PIRATE'), 20), status = 'live', started_at = now() where id = d.id;
  return mv || jsonb_build_object('duel', d.id, 'side', 'b', 'stake', d.stake, 'red', d.red_name);
end $$;
revoke all on function public.pvp_isl_duel_accept(text, text, uuid, text) from public, anon, authenticated;

-- ringside: during the open call + the first 25 s of the fight; never a fighter; one bet per pirate per fight
create or replace function public.pvp_isl_bet(p_player text, p_name text, p_duel uuid, p_side text, p_amount integer, p_req text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); d pvp_isl_duels; mv jsonb;
begin
  if not pvp_flag('island_gold') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  perform public.pvp_isl_lock(pid);   -- [review fix 2] this pirate's lock FIRST: caps, one-time checks + balance below run under it
  if p_side not in ('r', 'b') or p_amount is null or p_amount < 50 or p_amount > 500 then return jsonb_build_object('ok', false, 'why', 'bet 50 to 500'); end if;
  mv := public.pvp_isl_replay(pid, p_req, 'bet', p_duel::text, -p_amount);   -- [review fix 1] retry of this exact bet = first reply, else rejected
  if mv is not null then return mv || jsonb_build_object('duel', p_duel, 'side', p_side, 'amount', p_amount); end if;
  select * into d from pvp_isl_duels where id = p_duel for update;
  if not found or not (d.status = 'open' or (d.status = 'live' and d.started_at > now() - interval '25 seconds')) then return jsonb_build_object('ok', false, 'why', 'bets are locked'); end if;
  if pid = d.red_id or pid = d.blue_id then return jsonb_build_object('ok', false, 'why', 'fighters cannot bet'); end if;
  if exists (select 1 from pvp_isl_bets where duel_id = d.id and player_id = pid) then return jsonb_build_object('ok', false, 'why', 'one bet per fight'); end if;
  mv := public.pvp_isl_move(p_player, -p_amount, p_req, 'bet', d.id::text);
  if not coalesce((mv->>'ok')::boolean, false) then return mv; end if;
  if coalesce((mv->>'retry')::boolean, false) then return mv; end if;
  insert into pvp_isl_bets (duel_id, player_id, player_name, side, amount) values (d.id, pid, left(coalesce(p_name, ''), 20), p_side, p_amount);
  return mv || jsonb_build_object('duel', d.id, 'side', p_side, 'amount', p_amount);
end $$;
revoke all on function public.pvp_isl_bet(text, text, uuid, text, integer, text) from public, anon, authenticated;

-- settle: a fighter reports 'won' / 'lost' (first report wins: the KO'd side concedes, the KO'ing side claims), or 'cancel'
-- (the poster while nobody accepted, or anyone once the fight expired: open 5 min / live 10 min) = every stake + bet refunded.
-- Winner: the pot (2 x stake). Bets: the winning corner splits the whole pool pro-rata (floor); one-sided pools are refunded.
create or replace function public.pvp_isl_duel_settle(p_player text, p_duel uuid, p_result text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); d pvp_isl_duels; w char(1); wid text; wtot integer; ltot integer; bt pvp_isl_bets; pay integer; me jsonb; mv jsonb; expired boolean;
begin
  if not pvp_flag('island_gold') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  perform public.pvp_isl_lock(pid);   -- [review fix 2] this pirate's lock FIRST: caps, one-time checks + balance below run under it
  select * into d from pvp_isl_duels where id = p_duel for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'no such fight'); end if;
  if d.status in ('done', 'cancelled') then return jsonb_build_object('ok', true, 'status', d.status, 'winner', d.winner, 'settled', true); end if;
  expired := (d.status = 'open' and d.created_at < now() - interval '5 minutes') or (d.status = 'live' and d.started_at < now() - interval '10 minutes');
  if p_result = 'cancel' then
    if not (expired or (d.status = 'open' and d.red_id = pid)) then return jsonb_build_object('ok', false, 'why', 'the fight is on'); end if;
    me := public.pvp_isl_move(d.red_id, d.stake, 'duelref:r:' || d.id, 'duel_refund', d.id::text);
    if d.blue_id is not null then mv := public.pvp_isl_move(d.blue_id, d.stake, 'duelref:b:' || d.id, 'duel_refund', d.id::text); if d.blue_id = pid then me := mv; end if; end if;
    for bt in select * from pvp_isl_bets where duel_id = d.id loop
      mv := public.pvp_isl_move(bt.player_id, bt.amount, 'betref:' || bt.id, 'bet_refund', d.id::text); update pvp_isl_bets set payout = bt.amount where id = bt.id;
      if bt.player_id = pid then me := mv; end if; end loop;
    update pvp_isl_duels set status = 'cancelled', settled_at = now() where id = d.id;
    return coalesce(me, '{}'::jsonb) || jsonb_build_object('ok', true, 'status', 'cancelled');
  end if;
  if d.status <> 'live' then return jsonb_build_object('ok', false, 'why', 'nobody accepted yet'); end if;
  if pid <> d.red_id and pid <> d.blue_id then return jsonb_build_object('ok', false, 'why', 'not your fight'); end if;
  -- [review fix 3] who won is never one fighter's word for himself:
  --   'lost' = the LOSER's own authenticated client concedes (its battle saw its own KO by this opponent) -> the other corner wins;
  --   'won'  = pays only on a both-sides-confirmed kill on the board (pvp_kills via pvp_claim_kill: killer = you, victim = your opponent,
  --            after the fight started). Without one the claim is noted and the fight waits for the loser's concession, else it expires
  --            (live 10 min) and 'cancel' refunds both stakes + every bet.
  if p_result = 'lost' then w := case when pid = d.red_id then 'b' else 'r' end;
  elsif p_result = 'won' then
    w := case when pid = d.red_id then 'r' else 'b' end;
    if not exists (select 1 from pvp_kills k where k.killer_id = pid and k.victim_id = (case when w = 'r' then d.blue_id else d.red_id end)
                   and k.created_at >= d.started_at - interval '5 seconds') then
      update pvp_isl_duels set win_claim = w, win_claim_at = now() where id = d.id;
      return jsonb_build_object('ok', false, 'why', 'waiting for the knockout to confirm', 'pending', true);
    end if;
  else return jsonb_build_object('ok', false, 'why', 'bad result'); end if;
  wid := case when w = 'r' then d.red_id else d.blue_id end;
  mv := public.pvp_isl_move(wid, d.stake * 2, 'duelwin:' || d.id, 'duel_win', d.id::text);
  if wid = pid then me := mv; end if;
  select coalesce(sum(amount) filter (where side = w), 0), coalesce(sum(amount) filter (where side <> w), 0) into wtot, ltot from pvp_isl_bets where duel_id = d.id;
  for bt in select * from pvp_isl_bets where duel_id = d.id loop
    if wtot = 0 or ltot = 0 then pay := bt.amount; elsif bt.side = w then pay := floor(bt.amount::numeric * (wtot + ltot) / wtot)::integer; else pay := 0; end if;
    if pay > 0 then mv := public.pvp_isl_move(bt.player_id, pay, 'betwin:' || bt.id, case when wtot = 0 or ltot = 0 then 'bet_refund' else 'bet_win' end, d.id::text); end if;
    update pvp_isl_bets set payout = pay where id = bt.id;
  end loop;
  update pvp_isl_duels set status = 'done', winner = w, settled_at = now() where id = d.id;
  return coalesce(me, '{}'::jsonb) || jsonb_build_object('ok', true, 'status', 'done', 'winner', w, 'pot', d.stake * 2, 'you_won', wid = pid);
end $$;
revoke all on function public.pvp_isl_duel_settle(text, uuid, text) from public, anon, authenticated;

-- Skeleton Horde: waves in order, once per run, >= 12 s apart, 2 paid runs a day (1900 gold)
create or replace function public.pvp_isl_horde(p_player text, p_run text, p_wave integer, p_req text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); pay integer; v_ref text := left(coalesce(p_run, ''), 40) || ':' || coalesce(p_wave, 0); rp jsonb;
begin
  if not pvp_flag('island_gold') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  perform public.pvp_isl_lock(pid);   -- [review fix 2] this pirate's lock FIRST: caps, one-time checks + balance below run under it
  if p_run is null or p_run !~ '^[A-Za-z0-9_-]{8,40}$' or p_wave is null or p_wave < 1 or p_wave > 5 then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
  pay := (array[60, 90, 120, 160, 220])[p_wave] + case when p_wave = 5 then 300 else 0 end;
  rp := public.pvp_isl_replay(pid, p_req, 'horde', v_ref, pay); if rp is not null then return rp || jsonb_build_object('wave', p_wave, 'paid', pay); end if;   -- [review fix 1]
  if exists (select 1 from pvp_isl_ledger where player_id = pid and kind = 'horde' and ref = v_ref and req <> p_req) then return jsonb_build_object('ok', false, 'why', 'wave already paid'); end if;
  if p_wave > 1 and not exists (select 1 from pvp_isl_ledger where player_id = pid and kind = 'horde' and ref = left(p_run, 40) || ':' || (p_wave - 1)) then
    return jsonb_build_object('ok', false, 'why', 'clear the waves in order'); end if;
  if exists (select 1 from pvp_isl_ledger where player_id = pid and kind = 'horde' and created_at > now() - interval '12 seconds' and req <> p_req) then
    return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  return public.pvp_isl_move(p_player, pay, p_req, 'horde', v_ref, 1900) || jsonb_build_object('wave', p_wave, 'paid', pay);
end $$;
revoke all on function public.pvp_isl_horde(text, text, integer, text) from public, anon, authenticated;

-- ---------- 3. SMUGGLER CRATE RUNS ----------
create or replace function public.pvp_isl_crate(p_player text, p_tier text, p_run text, p_req text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); pay integer; n integer; rp jsonb;
begin
  if not pvp_flag('island_gold') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  perform public.pvp_isl_lock(pid);   -- [review fix 2] this pirate's lock FIRST: caps, one-time checks + balance below run under it
  pay := case p_tier when 'standard' then 100 when 'cutthroat' then 220 else 0 end;
  if pay = 0 or p_run is null or p_run !~ '^[A-Za-z0-9_-]{8,40}$' then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
  rp := public.pvp_isl_replay(pid, p_req, 'crate', p_run, pay); if rp is not null then return rp || jsonb_build_object('tier', p_tier, 'paid', pay); end if;   -- [review fix 1]
  if exists (select 1 from pvp_isl_ledger where player_id = pid and kind = 'crate' and ref = p_run and req <> p_req) then return jsonb_build_object('ok', false, 'why', 'crate already delivered'); end if;
  select count(*) into n from pvp_isl_ledger where player_id = pid and kind = 'crate' and day = pvp_isl_today();
  if n >= 12 then return jsonb_build_object('ok', false, 'why', 'daily cap'); end if;
  if exists (select 1 from pvp_isl_ledger where player_id = pid and kind = 'crate' and created_at > now() - interval '40 seconds' and req <> p_req) then
    return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  return public.pvp_isl_move(p_player, pay, p_req, 'crate', p_run, 2640) || jsonb_build_object('tier', p_tier, 'paid', pay);
end $$;
revoke all on function public.pvp_isl_crate(text, text, text, text) from public, anon, authenticated;

-- ---------- 4 + 5. ISLAND GOODS (crabs, pearls, ore, cane + spices, rum), timers, gathering, selling ----------
create table if not exists public.pvp_isl_items (
  item text primary key check (item ~ '^isl:[a-z_]{2,24}$'),
  src  text not null check (src in ('crab', 'dive', 'mine', 'plot', 'still'))
);
create table if not exists public.pvp_isl_prices (
  item  text not null references public.pvp_isl_items(item),
  shop  text not null check (shop in ('fish', 'antiques', 'rum')),
  price integer not null check (price > 0 and price <= 5000),
  primary key (item, shop)
);
-- = js/inventory/islandGoods.js (tests/v349IslandMoneyMakers.test.mjs checks both lists)
insert into public.pvp_isl_items (item, src) values
  ('isl:shore_crab', 'crab'), ('isl:blue_claw_crab', 'crab'), ('isl:spiny_king_crab', 'crab'), ('isl:golden_emperor_crab', 'crab'),
  ('isl:sea_pearl', 'dive'), ('isl:black_pearl', 'dive'), ('isl:barnacled_doubloons', 'dive'),
  ('isl:iron_ore', 'mine'), ('isl:refined_saltpeter', 'mine'), ('isl:cave_gold_nugget', 'mine'),
  ('isl:island_cane', 'plot'), ('isl:island_spices', 'plot'),
  ('isl:cottage_spiced_rum', 'still'), ('isl:reserve_spiced_rum', 'still')
  on conflict (item) do nothing;
insert into public.pvp_isl_prices (item, shop, price) values
  ('isl:shore_crab', 'fish', 40), ('isl:blue_claw_crab', 'fish', 85), ('isl:spiny_king_crab', 'fish', 170), ('isl:golden_emperor_crab', 'fish', 420),
  ('isl:sea_pearl', 'antiques', 120), ('isl:black_pearl', 'antiques', 450), ('isl:barnacled_doubloons', 'antiques', 220),
  ('isl:iron_ore', 'antiques', 45), ('isl:refined_saltpeter', 'antiques', 60), ('isl:cave_gold_nugget', 'antiques', 300),
  ('isl:island_cane', 'antiques', 12), ('isl:island_spices', 'antiques', 18),
  ('isl:cottage_spiced_rum', 'rum', 140), ('isl:cottage_spiced_rum', 'antiques', 110),
  ('isl:reserve_spiced_rum', 'rum', 175), ('isl:reserve_spiced_rum', 'antiques', 135)
  on conflict (item, shop) do nothing;

create table if not exists public.pvp_isl_goods (
  player_id  text not null,
  item       text not null references public.pvp_isl_items(item),
  qty        integer not null default 0 check (qty >= 0 and qty <= 9999),
  updated_at timestamptz not null default now(),
  primary key (player_id, item)
);
create table if not exists public.pvp_isl_goods_log (
  id bigserial primary key, player_id text not null, req text unique, src text not null, item text not null, qty integer not null,
  day date not null default ((now() at time zone 'America/Indiana/Indianapolis')::date), created_at timestamptz not null default now()
);
create index if not exists pvp_isl_goods_log_idx on public.pvp_isl_goods_log (player_id, src, day);
-- server timers: crab pots (slot = shore spot), spice plots + rum stills (slot = cottage id), dive / mine spot cooldowns
create table if not exists public.pvp_isl_timers (
  player_id  text not null,
  kind       text not null check (kind in ('crab', 'plot', 'still', 'dive', 'mine')),
  slot       text not null check (slot ~ '^[a-z0-9_]{2,24}$'),
  started_at timestamptz not null default now(),
  meta       jsonb not null default '{}'::jsonb,
  primary key (player_id, kind, slot)
);
alter table public.pvp_isl_ledger enable row level security;
alter table public.pvp_isl_bounties enable row level security;
alter table public.pvp_isl_bounty_log enable row level security;
alter table public.pvp_isl_duels enable row level security;
alter table public.pvp_isl_bets enable row level security;
alter table public.pvp_isl_items enable row level security;
alter table public.pvp_isl_prices enable row level security;
alter table public.pvp_isl_goods enable row level security;
alter table public.pvp_isl_goods_log enable row level security;
alter table public.pvp_isl_timers enable row level security;
revoke all on public.pvp_isl_ledger, public.pvp_isl_bounties, public.pvp_isl_bounty_log, public.pvp_isl_duels, public.pvp_isl_bets, public.pvp_isl_items,
  public.pvp_isl_prices, public.pvp_isl_goods, public.pvp_isl_goods_log, public.pvp_isl_timers from public, anon, authenticated;

-- grant goods to a pirate from one source (per-source daily item cap); internal (called by the gather / haul / harvest / bottle RPCs)
create or replace function public.pvp_isl_give(p_pid text, p_src text, p_items jsonb, p_req text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k text; v integer; tot integer := 0; used integer; cap integer := case p_src when 'crab' then 40 when 'dive' then 30 when 'mine' then 40 when 'plot' then 40 when 'still' then 16 else 0 end;
begin
  if exists (select 1 from pvp_isl_goods_log where req = p_req) then return jsonb_build_object('ok', true, 'retry', true); end if;
  for k, v in select key, (value)::int from jsonb_each_text(coalesce(p_items, '{}'::jsonb)) loop
    if v < 1 or v > 10 or not exists (select 1 from pvp_isl_items where item = k and src = p_src) then return jsonb_build_object('ok', false, 'why', 'bad item'); end if;
    tot := tot + v; end loop;
  if tot = 0 then return jsonb_build_object('ok', false, 'why', 'nothing'); end if;
  select coalesce(sum(qty), 0) into used from pvp_isl_goods_log where player_id = p_pid and src = p_src and day = pvp_isl_today();
  if used + tot > cap then return jsonb_build_object('ok', false, 'why', 'daily cap', 'cap', cap); end if;
  for k, v in select key, (value)::int from jsonb_each_text(p_items) loop
    insert into pvp_isl_goods (player_id, item, qty) values (p_pid, k, v)
      on conflict (player_id, item) do update set qty = least(9999, pvp_isl_goods.qty + v), updated_at = now();
    insert into pvp_isl_goods_log (player_id, req, src, item, qty) values (p_pid, case when k = (select min(key) from jsonb_each_text(p_items)) then p_req else null end, p_src, k, v);
  end loop;
  return jsonb_build_object('ok', true, 'items', p_items);
end $$;
revoke all on function public.pvp_isl_give(text, text, jsonb, text) from public, anon, authenticated;

create or replace function public.pvp_isl_goods_json(p_pid text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(item, qty), '{}'::jsonb) from pvp_isl_goods where player_id = p_pid and qty > 0 $$;
revoke all on function public.pvp_isl_goods_json(text) from public, anon, authenticated;

-- dive (after the client's O2 run succeeded) / mine (one swing): the server rolls the loot, per-spot cooldown 10 min (3 swings a mine node)
create or replace function public.pvp_isl_gather(p_player text, p_src text, p_spot text, p_kind text, p_req text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); t pvp_isl_timers; r double precision := random(); items jsonb; n integer; g jsonb;
begin
  if not pvp_flag('island_gold') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  perform public.pvp_isl_lock(pid);   -- [review fix 2] this pirate's lock FIRST: caps, one-time checks + balance below run under it
  if p_src not in ('dive', 'mine') or p_spot is null or p_spot !~ '^[a-z0-9_]{2,24}$' then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
  if exists (select 1 from pvp_isl_goods_log where req = p_req) then return jsonb_build_object('ok', true, 'retry', true, 'goods', pvp_isl_goods_json(pid)); end if;
  if not pvp_rl_hit('islg:' || pid, 60, 30) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  select * into t from pvp_isl_timers where player_id = pid and kind = p_src and slot = p_spot for update;
  n := coalesce((t.meta->>'n')::int, 0);
  if found and t.started_at > now() - interval '10 minutes' and n >= (case when p_src = 'mine' then 3 else 1 end) then
    return jsonb_build_object('ok', false, 'why', 'depleted', 'left_s', ceil(extract(epoch from (t.started_at + interval '10 minutes' - now())))); end if;
  if not found or t.started_at <= now() - interval '10 minutes' then n := 0; end if;
  if p_src = 'dive' then
    items := case when p_kind = 'chest' then (case when r < 0.55 then jsonb_build_object('isl:barnacled_doubloons', 1 + (r < 0.2)::int) when r < 0.9 then '{"isl:sea_pearl":1}'::jsonb else '{"isl:black_pearl":1}'::jsonb end)
             else (case when r < 0.8 then jsonb_build_object('isl:sea_pearl', 1 + (r < 0.25)::int) else '{"isl:black_pearl":1}'::jsonb end) end;
  else
    items := case p_kind when 'gold' then '{"isl:cave_gold_nugget":1}'::jsonb when 'saltpeter' then jsonb_build_object('isl:refined_saltpeter', 1 + (r < 0.5)::int)
             else jsonb_build_object('isl:iron_ore', 1 + (r < 0.5)::int) end;
  end if;
  g := public.pvp_isl_give(pid, p_src, items, p_req);
  if not coalesce((g->>'ok')::boolean, false) then return g; end if;
  insert into pvp_isl_timers (player_id, kind, slot, started_at, meta) values (pid, p_src, p_spot, now(), jsonb_build_object('n', 1))
    on conflict (player_id, kind, slot) do update set started_at = case when n = 0 then now() else pvp_isl_timers.started_at end, meta = jsonb_build_object('n', n + 1);
  return jsonb_build_object('ok', true, 'items', items, 'left', greatest(0, (case when p_src = 'mine' then 3 else 1 end) - (n + 1)), 'goods', pvp_isl_goods_json(pid));
end $$;
revoke all on function public.pvp_isl_gather(text, text, text, text, text) from public, anon, authenticated;

-- start a timer: crab pot (max 3 set, slot = shore spot), spice plot / rum still (slot = a cottage YOU own). Still: homegrown = takes 2 cane + 1 spice
-- (brews RESERVE), else the 25 gold mash (pvp_isl_move debit).
create or replace function public.pvp_isl_timer_start(p_player text, p_kind text, p_slot text, p_homegrown boolean, p_req text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); mv jsonb := '{}'::jsonb; c integer; s integer;
begin
  if not pvp_flag('island_gold') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  perform public.pvp_isl_lock(pid);   -- [review fix 2] this pirate's lock FIRST: caps, one-time checks + balance below run under it
  if p_kind not in ('crab', 'plot', 'still') or p_slot is null or p_slot !~ '^[a-z0-9_]{2,24}$' then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
  if exists (select 1 from pvp_isl_timers where player_id = pid and kind = p_kind and slot = p_slot) then return jsonb_build_object('ok', false, 'why', 'already set'); end if;
  if p_kind = 'crab' and (select count(*) from pvp_isl_timers where player_id = pid and kind = 'crab') >= 3 then return jsonb_build_object('ok', false, 'why', 'three pots max'); end if;
  if p_kind in ('plot', 'still') and pid <> public.pvp_inv_owner() and not exists (select 1 from pvp_houses where player_id = pid and cottage_id = p_slot) then
    return jsonb_build_object('ok', false, 'why', 'buy this cottage first'); end if;
  if p_kind = 'still' then
    if coalesce(p_homegrown, false) then
      perform 1 from pvp_isl_goods where player_id = pid and item in ('isl:island_cane', 'isl:island_spices') for update;
      select coalesce((select qty from pvp_isl_goods where player_id = pid and item = 'isl:island_cane'), 0),
             coalesce((select qty from pvp_isl_goods where player_id = pid and item = 'isl:island_spices'), 0) into c, s;
      if c < 2 or s < 1 then return jsonb_build_object('ok', false, 'why', 'need 2 cane + 1 spice'); end if;
      update pvp_isl_goods set qty = qty - 2, updated_at = now() where player_id = pid and item = 'isl:island_cane';
      update pvp_isl_goods set qty = qty - 1, updated_at = now() where player_id = pid and item = 'isl:island_spices';
    else
      mv := public.pvp_isl_move(p_player, -25, p_req, 'rum_mash', p_slot);
      if not coalesce((mv->>'ok')::boolean, false) then return mv; end if;
    end if;
  end if;
  insert into pvp_isl_timers (player_id, kind, slot, meta) values (pid, p_kind, p_slot, jsonb_build_object('homegrown', coalesce(p_homegrown, false)));
  return mv || jsonb_build_object('ok', true, 'kind', p_kind, 'slot', p_slot, 'started_at', now(), 'goods', pvp_isl_goods_json(pid));
end $$;
revoke all on function public.pvp_isl_timer_start(text, text, text, boolean, text) from public, anon, authenticated;

-- finish a timer once it is due: crab pot 15 min (2-4 crabs, server-rolled), spice plot 13 min (2 cane + 2 spices), still 15 min (2 bottles)
create or replace function public.pvp_isl_timer_finish(p_player text, p_kind text, p_slot text, p_req text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); t pvp_isl_timers; need integer; items jsonb := '{}'::jsonb; i integer; r double precision; v_id text; n integer; g jsonb;
begin
  if not pvp_flag('island_gold') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  perform public.pvp_isl_lock(pid);   -- [review fix 2] this pirate's lock FIRST: caps, one-time checks + balance below run under it
  if exists (select 1 from pvp_isl_goods_log where req = p_req) then return jsonb_build_object('ok', true, 'retry', true, 'goods', pvp_isl_goods_json(pid)); end if;
  select * into t from pvp_isl_timers where player_id = pid and kind = p_kind and slot = p_slot for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'nothing set here'); end if;
  need := case p_kind when 'crab' then 900 when 'plot' then 780 when 'still' then 900 else 0 end;
  if need = 0 then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
  if t.started_at > now() - make_interval(secs => need - 5) then return jsonb_build_object('ok', false, 'why', 'not ready', 'left_s', ceil(extract(epoch from (t.started_at + make_interval(secs => need) - now())))); end if;
  if p_kind = 'crab' then
    n := 2 + (case when random() < 0.5 then 0 when random() < 0.7 then 1 else 2 end);
    for i in 1..n loop r := random();
      v_id := case when r < 0.6 then 'isl:shore_crab' when r < 0.88 then 'isl:blue_claw_crab' when r < 0.98 then 'isl:spiny_king_crab' else 'isl:golden_emperor_crab' end;
      items := jsonb_set(items, array[v_id], to_jsonb(coalesce((items->>v_id)::int, 0) + 1), true); end loop;
  elsif p_kind = 'plot' then items := '{"isl:island_cane":2,"isl:island_spices":2}'::jsonb;
  else items := case when coalesce((t.meta->>'homegrown')::boolean, false) then '{"isl:reserve_spiced_rum":2}'::jsonb else '{"isl:cottage_spiced_rum":2}'::jsonb end; end if;
  g := public.pvp_isl_give(pid, p_kind, items, p_req);
  if not coalesce((g->>'ok')::boolean, false) then return g; end if;
  delete from pvp_isl_timers where player_id = pid and kind = p_kind and slot = p_slot;
  return jsonb_build_object('ok', true, 'kind', p_kind, 'slot', p_slot, 'items', items, 'goods', pvp_isl_goods_json(pid));
end $$;
revoke all on function public.pvp_isl_timer_finish(text, text, text, text) from public, anon, authenticated;

-- sell island goods at the FISH MARKET / TREASURE TRADER / HARBOR RUM EXPORT STALL (server price table)
create or replace function public.pvp_isl_sell(p_player text, p_item text, p_qty integer, p_shop text, p_req text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); pr integer; have integer; q integer := coalesce(p_qty, 0); mv jsonb;
begin
  if not pvp_flag('island_gold') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  perform public.pvp_isl_lock(pid);   -- [review fix 2] this pirate's lock FIRST: caps, one-time checks + balance below run under it
  if q < 1 or q > 999 then return jsonb_build_object('ok', false, 'why', 'bad qty'); end if;
  select price into pr from pvp_isl_prices where item = p_item and shop = p_shop;
  if pr is null then return jsonb_build_object('ok', false, 'why', 'this shop does not buy that'); end if;
  mv := public.pvp_isl_replay(pid, p_req, 'sell', p_item, pr * q);   -- [review fix 1] same item + same total, else rejected
  if mv is not null then return mv || jsonb_build_object('goods', pvp_isl_goods_json(pid)); end if;
  select qty into have from pvp_isl_goods where player_id = pid and item = p_item for update;
  if coalesce(have, 0) < q then return jsonb_build_object('ok', false, 'why', 'not enough', 'have', coalesce(have, 0)); end if;
  mv := public.pvp_isl_move(p_player, pr * q, p_req, 'sell', p_item);
  if not coalesce((mv->>'ok')::boolean, false) then return mv; end if;
  update pvp_isl_goods set qty = qty - q, updated_at = now() where player_id = pid and item = p_item;
  return mv || jsonb_build_object('sold', q, 'item', p_item, 'price', pr, 'goods', pvp_isl_goods_json(pid));
end $$;
revoke all on function public.pvp_isl_sell(text, text, integer, text, text) from public, anon, authenticated;

-- ---------- reads ----------
-- one pirate: goods, timers, today's contract claims / horde gold / crates, gold landed for you (duel wins, bets, refunds) after p_since
create or replace function public.pvp_isl_state(p_player text, p_since bigint default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); g integer; rv integer := 0;
begin
  if pid = public.pvp_inv_owner() then select gold into g from pvp_group_saves where main = pid;
  elsif pid like 'wallet:%' then select gold, shop_rev into g, rv from pvp_profiles where id = pid;
  else select gold, shop_rev into g, rv from pvp_dev_profiles where id = pid; end if;
  return jsonb_build_object('ok', true, 'gold', g, 'rev', coalesce(rv, 0), 'owner', pid = public.pvp_inv_owner(),
    'goods', pvp_isl_goods_json(pid),
    'timers', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'slot', slot, 'started_at', started_at, 'meta', meta)) from pvp_isl_timers where player_id = pid), '[]'::jsonb),
    'contracts', coalesce((select jsonb_agg(ref) from pvp_isl_ledger where player_id = pid and kind = 'contract' and day = pvp_isl_today()), '[]'::jsonb),
    'horde_today', coalesce((select sum(delta) from pvp_isl_ledger where player_id = pid and kind = 'horde' and day = pvp_isl_today()), 0),
    'crates_today', (select count(*) from pvp_isl_ledger where player_id = pid and kind = 'crate' and day = pvp_isl_today()),
    'credits', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'delta', delta, 'ref', ref) order by id) from pvp_isl_ledger
      where player_id = pid and id > coalesce(p_since, 0) and kind in ('duel_win', 'duel_refund', 'bet_win', 'bet_refund') and created_at > now() - interval '30 minutes'), '[]'::jsonb),
    'last_id', coalesce((select max(id) from pvp_isl_ledger where player_id = pid), 0));
end $$;
revoke all on function public.pvp_isl_state(text, bigint) from public, anon, authenticated;

-- the island board everyone sees: the Wanted list, open + live Coliseum fights with their ringside pools, the last minute's bounty claims
create or replace function public.pvp_isl_board()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true,
    'wanted', coalesce((select jsonb_agg(jsonb_build_object('name', target_name, 'pot', pot, 'posts', posts) order by pot desc) from
      (select * from pvp_isl_bounties where pot > 0 order by pot desc limit 20) b), '[]'::jsonb),
    'duels', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'red', d.red_name, 'blue', d.blue_name, 'stake', d.stake, 'status', d.status, 'winner', d.winner,
        'age_s', floor(extract(epoch from now() - d.created_at)), 'live_s', case when d.started_at is null then null else floor(extract(epoch from now() - d.started_at)) end,
        'pool_r', coalesce((select sum(amount) from pvp_isl_bets where duel_id = d.id and side = 'r'), 0),
        'pool_b', coalesce((select sum(amount) from pvp_isl_bets where duel_id = d.id and side = 'b'), 0)) order by d.created_at desc)
      from pvp_isl_duels d where (d.status in ('open', 'live') and d.created_at > now() - interval '15 minutes') or (d.status = 'done' and d.settled_at > now() - interval '90 seconds')), '[]'::jsonb),
    'claims', coalesce((select jsonb_agg(jsonb_build_object('killer', l.actor_name, 'target', l.target_key, 'gold', l.amount, 'at', l.created_at) order by l.id desc)
      from pvp_isl_bounty_log l where l.kind = 'claim' and l.created_at > now() - interval '90 seconds'), '[]'::jsonb)) $$;
revoke all on function public.pvp_isl_board() from public, anon, authenticated;

commit;
