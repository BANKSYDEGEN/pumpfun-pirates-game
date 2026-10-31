-- v76: one name = one pirate, across BATTLE ROYALE and WAVES (case-insensitive, trimmed). Additive; existing duplicates are
-- grandfathered (nobody renamed or deleted), new claims of a taken name are blocked.
-- Owner of a name: a BR player id (device key or signed wallet), or a Waves wallet. The same pirate may reuse its own name:
--   * the same BR id, or a device + the wallet it SIGNED in with (pvp_links);
--   * on Waves, the wallet that already has score rows under that name;
--   * across modes, only a SIGNED wallet id (wallet:<W>) matches Waves wallet <W>. A typed wallet label grants nothing.
create or replace function public.pvp_name_free(p_name text, p_player text, p_wallet text) returns boolean
language sql stable security definer set search_path = public as $$
  with n as (select lower(btrim(coalesce(p_name, ''))) as v)
  select (select v from n) = '' or (
    not exists (  -- a different BR player owns it
      select 1 from pvp_players p, n where lower(btrim(p.name)) = n.v and p.id is distinct from p_player
        and not exists (select 1 from pvp_links k where (k.dev = p.id and k.wallet = p_player) or (k.dev = p_player and k.wallet = p.id))
        and not (p_wallet is not null and p.id = 'wallet:' || p_wallet))
    and not exists (  -- a different Waves wallet owns it
      select 1 from scores s, n where lower(btrim(s.name)) = n.v and s.wallet is distinct from p_wallet
        and s.wallet is distinct from (case when p_player like 'wallet:%' then substr(p_player, 8) end))
  );
$$;
revoke all on function public.pvp_name_free(text, text, text) from public, anon, authenticated;

-- BR board names: a taken name never lands (kill claims / renames). Update keeps the old name; a brand-new row gets a short suffix.
create or replace function public.pvp_players_name_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare w text;
begin
  if tg_op = 'UPDATE' and lower(btrim(new.name)) = lower(btrim(old.name)) then return new; end if;
  if pvp_name_free(new.name, new.id, case when new.id like 'wallet:%' then substr(new.id, 8) end) then return new; end if;
  if tg_op = 'UPDATE' then new.name := old.name;
  else new.name := left(btrim(new.name), 14) || ' #' || right(new.id, 4); end if;
  return new;
end $$;
drop trigger if exists pvp_players_name_guard on public.pvp_players;
create trigger pvp_players_name_guard before insert or update of name on public.pvp_players for each row execute function public.pvp_players_name_guard();

-- Waves scores: a name owned by someone else is dropped from the NEW row (the score itself is always kept).
create or replace function public.scores_name_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.name is null or btrim(new.name) = '' then return new; end if;
  if exists (select 1 from scores s where s.wallet = new.wallet and lower(btrim(s.name)) = lower(btrim(new.name))) then return new; end if; -- grandfathered / own
  if not pvp_name_free(new.name, null, new.wallet) then new.name := null; end if;
  return new;
end $$;
drop trigger if exists scores_name_guard on public.scores;
create trigger scores_name_guard before insert on public.scores for each row execute function public.scores_name_guard();

-- rename (v72) now uses the same rule (BR + Waves)
create or replace function public.pvp_rename(p_player text, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare nm text := left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]<>&"`\\]', '', 'g')), 20); n int; w text;
begin
  if p_player !~ '^(wallet:[1-9A-HJ-NP-Za-km-z]{32,44}|dev:[0-9a-f]{24})$' then return jsonb_build_object('ok', false, 'why', 'bad id'); end if;
  if char_length(nm) < 1 then return jsonb_build_object('ok', false, 'why', 'empty name'); end if;
  if not pvp_name_free(nm, p_player, case when p_player like 'wallet:%' then substr(p_player, 8) end) then
    return jsonb_build_object('ok', false, 'why', 'name taken');
  end if;
  update pvp_players set name = nm where id = p_player; get diagnostics n = row_count;
  update pvp_players set name = nm where id in (select dev from pvp_links where wallet = p_player);
  update pvp_airdrop set name = nm where player_id = p_player;
  return jsonb_build_object('ok', true, 'name', nm, 'rows', n);
end $$;
revoke all on function public.pvp_rename(text, text) from public, anon, authenticated;
