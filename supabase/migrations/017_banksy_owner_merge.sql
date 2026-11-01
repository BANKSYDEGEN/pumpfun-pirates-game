-- v85 OWNER-ONLY one-off (BANKSY, game owner, approved Nov 1 2026): his two Battle Royale device accounts are one pirate,
-- with no wallet signed. 'banksy' (dev:c53d…) is an alias of 'banksydegen' (dev:e191…), shown as BANKSYDEGEN.
-- pvp_alias is server-only (RLS, no grants): rows are added by hand here, never from the client. No player-facing linking.
-- Backup of every touched row: /workspace/backups/banksy_merge_20261101_154351.json (box, not in the repo).
create or replace function public.pvp_main(p_id text) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select main from pvp_alias where dev = p_id), p_id);
$$;
revoke all on function public.pvp_main(text) from public, anon, authenticated;

insert into public.pvp_alias (dev, main, note) values ('dev:c53da939472a7ae23f6dd873', 'dev:e191a32e15abea4f14355121', 'BANKSY owner merge v85 (owner-approved): banksy -> BANKSYDEGEN')
  on conflict (dev) do update set main = excluded.main, note = excluded.note;
-- the alias device's confirmed kills / deaths move to the main id (no kills exist between the two, checked)
update public.pvp_kills set killer_id = 'dev:e191a32e15abea4f14355121' where killer_id = 'dev:c53da939472a7ae23f6dd873' and victim_id <> 'dev:e191a32e15abea4f14355121';
update public.pvp_kills set victim_id = 'dev:e191a32e15abea4f14355121' where victim_id = 'dev:c53da939472a7ae23f6dd873' and killer_id <> 'dev:e191a32e15abea4f14355121';
update public.pvp_kill_claims set player_id = 'dev:e191a32e15abea4f14355121' where player_id = 'dev:c53da939472a7ae23f6dd873';
update public.pvp_net set player_id = 'dev:e191a32e15abea4f14355121' where player_id = 'dev:c53da939472a7ae23f6dd873';
-- the old 'BANKSY' board row is retired (name freed); the main row is named BANKSYDEGEN (his own Waves name: same owner)
delete from public.pvp_players where id = 'dev:c53da939472a7ae23f6dd873';
set local session_replication_role = replica;  -- skip the name guard for this one owner rename
update public.pvp_players set name = 'BANKSYDEGEN' where id = 'dev:e191a32e15abea4f14355121';
update public.pvp_airdrop set name = 'BANKSYDEGEN' where player_id in ('dev:c53da939472a7ae23f6dd873', 'dev:e191a32e15abea4f14355121');
set local session_replication_role = origin;

-- identity resolution: an alias device acts as its main id (kills, deaths, rank, name). The group's board name is pinned.
create or replace function public.pvp_claim_kill(p_player text, p_name text, p_room text, p_killer_net text, p_victim_net text, p_life integer, p_side text)
 returns text language plpgsql security definer set search_path to 'public' as $function$
declare own_net text; bound text; other record; k_id text; v_id text; n int;
begin
  p_player := pvp_main(p_player);
  if p_side not in ('k','v') then return 'bad side'; end if;
  if p_killer_net = p_victim_net then return 'self kill'; end if;
  insert into pvp_players (id, name, updated_at) values (p_player, coalesce(nullif(p_name, ''), 'PIRATE'), now())
    on conflict (id) do update set name = case when exists (select 1 from pvp_alias a where a.main = pvp_players.id) then pvp_players.name else excluded.name end, updated_at = now();
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
  if exists (select 1 from pvp_kills where killer_id = k_id and victim_id = v_id and created_at > now() - interval '20 seconds') then return 'same victim too soon'; end if;
  select count(*) into n from pvp_kills where killer_id = k_id and created_at > now() - interval '1 minute';
  if n >= 6 then return 'killer rate limited'; end if;
  select count(*) into n from pvp_kills where killer_id = k_id and created_at > now() - interval '1 day';
  if n >= 600 then return 'daily cap'; end if;
  insert into pvp_kills (killer_id, victim_id, room, killer_net, victim_net, life) values (k_id, v_id, p_room, p_killer_net, p_victim_net, p_life)
    on conflict do nothing;
  return 'recorded';
end $function$;

create or replace function public.pvp_kills_me(p_player text)
 returns table(rank bigint, kills bigint, deaths bigint) language sql stable security definer set search_path to 'public' as $function$
  with pid as (select pvp_main(p_player) as v),
       k as (select killer_id as id, count(*) as kills from pvp_kills group by killer_id),
       d as (select victim_id as id, count(*) as deaths from pvp_kills group by victim_id),
       ids as (select id from k union select id from d),
       b as (select ids.id, coalesce(k.kills, 0) as kills, coalesce(d.deaths, 0) as deaths, p.updated_at
             from ids left join pvp_players p on p.id = ids.id left join k on k.id = ids.id left join d on d.id = ids.id),
       me as (select coalesce((select kills from k where id = (select v from pid)), 0) as kills, coalesce((select deaths from d where id = (select v from pid)), 0) as deaths,
                     (select updated_at from pvp_players where id = (select v from pid)) as up)
  select case when me.kills = 0 and me.deaths = 0 then null else 1 + (select count(*) from b where b.id <> (select v from pid) and
           (b.kills > me.kills or (b.kills = me.kills and (b.deaths < me.deaths or (b.deaths = me.deaths and b.updated_at < me.up))))) end,
         me.kills, me.deaths
  from me;
$function$;

-- a pinned alias group's own name is always "free" for that group (so typing BANKSYDEGEN on either device is fine)
create or replace function public.pvp_name_free(p_name text, p_player text, p_wallet text)
 returns boolean language sql stable security definer set search_path to 'public' as $function$
  with n as (select lower(btrim(coalesce(p_name, ''))) as v), me as (select pvp_main(p_player) as id)
  select (select v from n) = ''
    or exists (select 1 from pvp_players p, pvp_alias a, n, me where p.id = me.id and a.main = p.id and lower(btrim(p.name)) = n.v)
    or (
    not exists (
      select 1 from pvp_players p, n, me where lower(btrim(p.name)) = n.v and p.id is distinct from me.id
        and not exists (select 1 from pvp_links k where (k.dev = p.id and k.wallet = me.id) or (k.dev = me.id and k.wallet = p.id))
        and not (p_wallet is not null and p.id = 'wallet:' || p_wallet))
    and not exists (
      select 1 from scores s, n, me where lower(btrim(s.name)) = n.v and s.wallet is distinct from p_wallet
        and s.wallet is distinct from (case when me.id like 'wallet:%' then substr(me.id, 8) end))
  );
$function$;
revoke all on function public.pvp_name_free(text, text, text) from public, anon, authenticated;

create or replace function public.pvp_rename(p_player text, p_name text)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare nm text := left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]<>&"`\\]', '', 'g')), 20); n int; w text;
begin
  if p_player !~ '^(wallet:[1-9A-HJ-NP-Za-km-z]{32,44}|dev:[0-9a-f]{24})$' then return jsonb_build_object('ok', false, 'why', 'bad id'); end if;
  p_player := pvp_main(p_player);
  if char_length(nm) < 1 then return jsonb_build_object('ok', false, 'why', 'empty name'); end if;
  -- pinned alias group (owner merge): only its own name, any letter case, is accepted; the stored name never changes
  if exists (select 1 from pvp_alias a where a.main = p_player) then
    if exists (select 1 from pvp_players p where p.id = p_player and lower(btrim(p.name)) = lower(nm)) then
      select name into nm from pvp_players where id = p_player; return jsonb_build_object('ok', true, 'name', nm, 'rows', 0); end if;
    return jsonb_build_object('ok', false, 'why', 'name taken');
  end if;
  if not pvp_name_free(nm, p_player, case when p_player like 'wallet:%' then substr(p_player, 8) end) then
    return jsonb_build_object('ok', false, 'why', 'name taken');
  end if;
  update pvp_players set name = nm where id = p_player; get diagnostics n = row_count;
  update pvp_players set name = nm where id in (select dev from pvp_links where wallet = p_player);
  update pvp_airdrop set name = nm where player_id = p_player;
  return jsonb_build_object('ok', true, 'name', nm, 'rows', n);
end $function$;
revoke all on function public.pvp_rename(text, text) from public, anon, authenticated;
