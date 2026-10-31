-- v72 (additive only; nothing deleted, no scores reset):
--  * pvp_links: a device key (dev:<hash>) that signs in with a wallet is linked to it ONCE. Its confirmed BATTLE ROYALE
--    kills / deaths move to the wallet identity, so the kills board and '#' rank follow the wallet across devices.
--  * pvp_link_device(): does that move (first wallet only; a device can never be re-pointed to another wallet).
--  * pvp_rename(): the caller's OWN board name (id comes from the server-checked session / device key, never the client).
create table if not exists public.pvp_links (
  dev        text primary key check (dev ~ '^dev:[0-9a-f]{24}$'),
  wallet     text not null check (wallet ~ '^wallet:[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  merged     boolean not null default false,   -- device save merged into the wallet save (once)
  created_at timestamptz not null default now()
);
alter table public.pvp_links enable row level security;
revoke all on public.pvp_links from anon, authenticated;

create or replace function public.pvp_link_device(p_dev text, p_wallet text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l pvp_links; nk int := 0; nd int := 0; nm text;
begin
  if p_dev !~ '^dev:[0-9a-f]{24}$' or p_wallet !~ '^wallet:[1-9A-HJ-NP-Za-km-z]{32,44}$' then return jsonb_build_object('ok', false, 'why', 'bad id'); end if;
  select * into l from pvp_links where dev = p_dev;
  if found and l.wallet <> p_wallet then return jsonb_build_object('ok', false, 'why', 'device linked to another wallet'); end if;
  if not found then insert into pvp_links (dev, wallet) values (p_dev, p_wallet); end if;
  -- the wallet gets a board name (the device's) if it has none yet
  select name into nm from pvp_players where id = p_dev;
  if nm is not null then insert into pvp_players (id, name) values (p_wallet, nm) on conflict (id) do nothing; end if;
  -- confirmed kills / deaths follow the wallet (rows kept, only the identity column changes; never a self-kill)
  update pvp_kills set killer_id = p_wallet where killer_id = p_dev and victim_id <> p_wallet; get diagnostics nk = row_count;
  update pvp_kills set victim_id = p_wallet where victim_id = p_dev and killer_id <> p_wallet; get diagnostics nd = row_count;
  return jsonb_build_object('ok', true, 'kills', nk, 'deaths', nd, 'merged', coalesce(l.merged, false));
end $$;
revoke all on function public.pvp_link_device(text, text) from public, anon, authenticated;

create or replace function public.pvp_rename(p_player text, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare nm text := left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]<>&"`\\]', '', 'g')), 20); n int;
begin
  if p_player !~ '^(wallet:[1-9A-HJ-NP-Za-km-z]{32,44}|dev:[0-9a-f]{24})$' then return jsonb_build_object('ok', false, 'why', 'bad id'); end if;
  if char_length(nm) < 1 then return jsonb_build_object('ok', false, 'why', 'empty name'); end if;
  -- taken by a different pirate on the BATTLE ROYALE board (case-insensitive); a device linked to this wallet doesn't count
  if exists (select 1 from pvp_players p where lower(p.name) = lower(nm) and p.id <> p_player
             and not exists (select 1 from pvp_links k where (k.dev = p.id and k.wallet = p_player) or (k.dev = p_player and k.wallet = p.id))) then
    return jsonb_build_object('ok', false, 'why', 'name taken');
  end if;
  update pvp_players set name = nm where id = p_player; get diagnostics n = row_count;
  update pvp_players set name = nm where id in (select dev from pvp_links where wallet = p_player);
  update pvp_airdrop set name = nm where player_id = p_player;
  return jsonb_build_object('ok', true, 'name', nm, 'rows', n);
end $$;
revoke all on function public.pvp_rename(text, text) from public, anon, authenticated;
