-- PUMPFUN PIRATES · migration 027 (v106): PLAYER ACCOUNTS (BANKSY: "Add the account password part next").
-- No sign-up: a pirate's unique in-game name IS the account. The pirate can SET A PASSWORD for it (profile page); on another
-- device they LOG IN with name + password and that device plays as the same pirate (pvp_main resolves it to the account id),
-- so gold, upgrades, skins, gear, parrots, stats, goals, treasure maps and board entries are the same everywhere.
-- ADDITIVE ONLY: three new tables, one new trigger, new functions; pvp_main / pvp_name_free / pvp_group_sync are re-created
-- with the SAME behaviour for every existing pirate (the new tables start empty). No gold, score, kill, board or player row is
-- updated or deleted. Server-only like 005/022: RLS on, no policies, no anon / authenticated grants (only the `pvp` Edge
-- Function, service role, touches them). Passwords: bcrypt hashes made in the Edge Function; never stored or logged in plain text.
-- Backup before applying: /workspace/backups/accounts/*.json (box, not the repo).
begin;

-- 1) one row per pirate with a password. main = the pirate's resolved id (pvp_main of the device that set it).
create table if not exists public.pvp_accounts (
  main       text primary key check (main ~ '^dev:[0-9a-f]{24}$'),
  name       text not null check (char_length(btrim(name)) between 1 and 20),
  pw_hash    text not null check (pw_hash ~ '^\$2[aby]\$'),
  pw_set_at  timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists pvp_accounts_name_uq on public.pvp_accounts (lower(btrim(name)));

-- 2) logged-in devices: this device's id plays as `main` until the session expires / logs out / the password changes.
--    token_hash = SHA-256 of the random session token (the client keeps only the token). last = the account gold + stats this
--    device last saw (its next sync sends only what changed since: two devices never overwrite each other).
create table if not exists public.pvp_acct_devices (
  dev        text primary key check (dev ~ '^dev:[0-9a-f]{24}$'),
  main       text not null references public.pvp_accounts (main),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  last       jsonb not null default '{}'::jsonb,
  last_at    timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists pvp_acct_devices_main_idx on public.pvp_acct_devices (main);

-- 3) login / password attempts (rate limits per name and per hashed IP; never the password)
create table if not exists public.pvp_acct_attempts (
  id         bigserial primary key,
  name_lc    text,
  ip_hash    text,
  kind       text not null check (kind in ('login', 'set', 'change')),
  ok         boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists pvp_acct_attempts_name_idx on public.pvp_acct_attempts (name_lc, created_at desc);
create index if not exists pvp_acct_attempts_ip_idx on public.pvp_acct_attempts (ip_hash, created_at desc);

alter table public.pvp_accounts enable row level security;
alter table public.pvp_acct_devices enable row level security;
alter table public.pvp_acct_attempts enable row level security;
revoke all on public.pvp_accounts, public.pvp_acct_devices, public.pvp_acct_attempts from public, anon, authenticated;
revoke all on sequence public.pvp_acct_attempts_id_seq from public, anon, authenticated;

-- 4) identity: the owner alias (017) first, then a live account login, else the id itself (unchanged for everyone else)
create or replace function public.pvp_main(p_id text) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select main from pvp_alias where dev = p_id),
                  (select main from pvp_acct_devices where dev = p_id and expires_at > now()),
                  p_id);
$$;
revoke all on function public.pvp_main(text) from public, anon, authenticated;

-- 5) names: as 017, plus an account's name is always free for that account (and a wallet signed in on one of its logged-in
--    devices) and taken for everyone else
create or replace function public.pvp_name_free(p_name text, p_player text, p_wallet text)
 returns boolean language sql stable security definer set search_path to 'public' as $function$
  with n as (select lower(btrim(coalesce(p_name, ''))) as v), me as (select pvp_main(p_player) as id)
  select (select v from n) = ''
    or exists (select 1 from pvp_players p, pvp_alias a, n, me where p.id = me.id and a.main = p.id and lower(btrim(p.name)) = n.v)
    or exists (select 1 from pvp_accounts c, n, me where c.main = me.id and lower(btrim(c.name)) = n.v)
    or (
    not exists (select 1 from pvp_accounts c, n, me where lower(btrim(c.name)) = n.v and c.main is distinct from me.id
        and not exists (select 1 from pvp_links k where k.wallet = me.id and pvp_main(k.dev) = c.main)) -- a wallet linked on a logged-in device
    and not exists (
      select 1 from pvp_players p, n, me where lower(btrim(p.name)) = n.v and p.id is distinct from me.id
        and not exists (select 1 from pvp_links k where (k.dev = p.id and k.wallet = me.id) or (k.dev = me.id and k.wallet = p.id) or (k.wallet = me.id and pvp_main(k.dev) = p.id))
        and not (p_wallet is not null and p.id = 'wallet:' || p_wallet))
    and not exists (
      select 1 from scores s, n, me where lower(btrim(s.name)) = n.v and s.wallet is distinct from p_wallet
        and s.wallet is distinct from (case when me.id like 'wallet:%' then substr(me.id, 8) end))
  );
$function$;
revoke all on function public.pvp_name_free(text, text, text) from public, anon, authenticated;

-- 6) the account follows its board name (a rename of the main row renames the account; a clash keeps the old account name)
create or replace function public.pvp_acct_follow_name() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(btrim(new.name)) is distinct from lower(btrim(old.name)) then
    begin
      update pvp_accounts set name = btrim(new.name), updated_at = now() where main = new.id;
    exception when unique_violation then null;
    end;
  end if;
  return new;
end $$;
revoke all on function public.pvp_acct_follow_name() from public, anon, authenticated;
drop trigger if exists pvp_acct_follow_name on public.pvp_players;
create trigger pvp_acct_follow_name after update of name on public.pvp_players for each row execute function public.pvp_acct_follow_name();

-- 7) owner shared save (018/019): same rule, the group is found through pvp_main, so the owner's account login on a new device
--    joins the owner group (its first sync adds that device's local gold once: the client logs in with 0 gold)
create or replace function public.pvp_group_sync(p_dev text, p_gold integer, p_delta integer, p_levels jsonb, p_gain_base integer, p_gain_per_min integer)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare m text := pvp_main(p_dev); r pvp_group_saves; lv jsonb := '{}'::jsonb; k text; seeded boolean := false;
begin
  if not exists (select 1 from pvp_alias a where a.main = m) then return jsonb_build_object('ok', false, 'why', 'not a group'); end if;
  insert into pvp_group_saves (main) values (m) on conflict (main) do nothing;
  select * into r from pvp_group_saves where main = m for update;
  for k in select distinct x from (select jsonb_object_keys(r.upgrades) x union select jsonb_object_keys(coalesce(p_levels, '{}'::jsonb))) s loop
    lv := lv || jsonb_build_object(k, greatest(coalesce((r.upgrades->>k)::int, 0), least(8, greatest(0, coalesce((p_levels->>k)::int, 0)))));
  end loop;
  if not (p_dev = any(r.devs)) then  -- first sync from this device: add its local gold once
    r.gold := least(10000000, r.gold + greatest(0, least(coalesce(p_gold, 0), 10000000))); r.devs := r.devs || p_dev; seeded := true;
  else
    if coalesce(p_delta, 0) > p_gain_base + round(p_gain_per_min * least(60, extract(epoch from now() - r.updated_at) / 60))::int then
      return jsonb_build_object('ok', false, 'why', 'gold gained too fast');
    end if;
    r.gold := least(10000000, greatest(0, r.gold + coalesce(p_delta, 0)));
  end if;
  update pvp_group_saves set gold = r.gold, upgrades = lv, devs = r.devs, updated_at = now() where main = m;
  return jsonb_build_object('ok', true, 'gold', r.gold, 'levels', lv, 'seeded', seeded, 'devices', coalesce(array_length(r.devs, 1), 0));
end $function$;
revoke all on function public.pvp_group_sync(text, integer, integer, jsonb, integer, integer) from public, anon, authenticated;

-- 8) a server-side credit / spend made by a logged-in device (shop buy, Waves payout, treasure dig) is mirrored on that
--    device's `last`, because the device applies the same change to its own save (so its next sync doesn't count it twice)
create or replace function public.pvp_acct_bump(p_dev text, p_gold integer) returns void language sql security definer set search_path = public as $$
  update pvp_acct_devices set last = jsonb_set(last, '{gold}', to_jsonb(coalesce((last->>'gold')::bigint, 0) + coalesce(p_gold, 0)))
  where dev = p_dev and expires_at > now();
$$;
revoke all on function public.pvp_acct_bump(text, integer) from public, anon, authenticated;

-- 9) OWNER-ONLY admin reset (no UI): run with the service role, e.g. from the SQL editor, with a bcrypt hash made offline.
--    Sets the new hash and logs every device of that pirate out. Never callable by players.
create or replace function public.pvp_acct_admin_reset(p_name text, p_hash text) returns jsonb language plpgsql security definer set search_path = public as $$
declare m text; n int;
begin
  if p_hash !~ '^\$2[aby]\$' then return jsonb_build_object('ok', false, 'why', 'not a bcrypt hash'); end if;
  update pvp_accounts set pw_hash = p_hash, pw_set_at = now(), updated_at = now() where lower(btrim(name)) = lower(btrim(p_name)) returning main into m;
  if m is null then return jsonb_build_object('ok', false, 'why', 'no such account'); end if;
  delete from pvp_acct_devices where main = m; get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'logged_out', n);
end $$;
revoke all on function public.pvp_acct_admin_reset(text, text) from public, anon, authenticated;

commit;
-- ROLLBACK (behaviour only, nothing deleted): re-run 017's pvp_main / pvp_name_free and 019's pvp_group_sync; the account
-- tables can stay (unused).
