-- PUMPFUN PIRATES · migration 010: PvP KILLS board records every kill both sides confirm.
-- Root cause (2026-10-31): pvp_claim_kill dropped a confirmed kill when the same killer had sunk the same victim in the last
-- 2 minutes ('same victim too soon'). In a 1v1 arena almost every kill is a repeat, so the board kept ~1 in 2 kills while the
-- player's own K/D (and kill-unlocked skins) counted all of them. Now: repeats count unless within 20 s (spawn-camping guard;
-- spawn protection covers the first seconds anyway). The 6 / minute and 600 / day killer caps stay.
-- Additive only: no rows are deleted or reset.
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
  -- spawn-camp guard: the same killer on the same victim again within 20 s doesn't count (was 2 minutes)
  if exists (select 1 from pvp_kills where killer_id = k_id and victim_id = v_id and created_at > now() - interval '20 seconds') then return 'same victim too soon'; end if;
  select count(*) into n from pvp_kills where killer_id = k_id and created_at > now() - interval '1 minute';
  if n >= 6 then return 'killer rate limited'; end if;
  select count(*) into n from pvp_kills where killer_id = k_id and created_at > now() - interval '1 day';
  if n >= 600 then return 'daily cap'; end if;
  insert into pvp_kills (killer_id, victim_id, room, killer_net, victim_net, life) values (k_id, v_id, p_room, p_killer_net, p_victim_net, p_life)
    on conflict do nothing;
  return 'recorded';
end $$;
revoke all on function public.pvp_claim_kill(text, text, text, text, text, integer, text) from public, anon, authenticated;

-- one-off reconcile (2026-10-31): kills BOTH sides confirmed (a used claim pair) that the old 2-minute rule dropped.
-- Only the live arena rooms (pfp-pvp-v1-*), only claims whose two net ids map to two different players, kept at the claim's time.
insert into pvp_kills (killer_id, victim_id, room, killer_net, victim_net, life, created_at)
select kn.player_id, vn.player_id, c.room, c.killer_net, c.victim_net, c.life, c.created_at
from pvp_kill_claims c join pvp_net kn on kn.net_id = c.killer_net join pvp_net vn on vn.net_id = c.victim_net
where c.used and c.room like 'pfp-pvp-v1-%' and kn.player_id <> vn.player_id
  and not exists (select 1 from pvp_kills k where k.room = c.room and k.killer_net = c.killer_net and k.victim_net = c.victim_net and k.life = c.life)
on conflict do nothing;
