-- PUMPFUN PIRATES · migration 067 (BANKSY t2222u/t2223u: "Pilly" the pump.fun pill = an on-foot COMPANION you level up,
-- equipable AT THE SAME TIME as your parrot / shoulder pet: its own slot, never touches gear.parrot or pvp_parrot_equipped).
-- Ownership + out flag = pvp_companions (one row per player per companion). Name + XP reuse pvp_pets (pet 'pet_pilly', level
-- = pvp_pet_lv, 0..10). XP mirrors the parrot: +1 per walk tick (1 per 55 s while Pilly is out), treats +100 xp at 250*(lv+1)^2 gold.
-- Price 5000 gold (PROPOSED). The owner's kit owns it by rule. Service-role only (pvp edge function: pilly_* actions).
begin;
create table if not exists public.pvp_companions (
  player_id text not null,
  pet       text not null check (pet in ('pet_pilly')),
  out       boolean not null default true,
  price     integer not null default 0,
  created   timestamptz not null default now(),
  primary key (player_id, pet)
);
alter table public.pvp_companions enable row level security;
revoke all on public.pvp_companions from anon, authenticated;

create or replace function public.pvp_pilly_op(p_player text, p_op text, p_name text default null, p_out boolean default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); is_owner boolean := pid = public.pvp_inv_owner();
  owns boolean; o boolean; x integer; lv integer; cost integer; g integer; nm text; price constant integer := 5000;
begin
  select out into o from pvp_companions where player_id = pid and pet = 'pet_pilly';
  owns := found or is_owner; o := coalesce(o, is_owner);
  if p_op = 'buy' then
    if owns then return jsonb_build_object('ok', false, 'why', 'you already have Pilly'); end if;
    if not pvp_rl_hit('pillyb:' || pid, 60, 5) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
    g := pvp_pet_gold(pid, -price); if g is null then return jsonb_build_object('ok', false, 'why', 'not enough gold', 'cost', price); end if;
    insert into pvp_companions (player_id, pet, out, price) values (pid, 'pet_pilly', true, price);
    owns := true; o := true;
  elsif p_op = 'out' then
    if not owns then return jsonb_build_object('ok', false, 'why', 'not your companion'); end if;
    o := coalesce(p_out, not o);
    insert into pvp_companions (player_id, pet, out, price) values (pid, 'pet_pilly', o, 0) on conflict (player_id, pet) do update set out = excluded.out;
  elsif p_op = 'name' then
    if not owns then return jsonb_build_object('ok', false, 'why', 'not your companion'); end if;
    if p_name is not null and char_length(p_name) > 16 then return jsonb_build_object('ok', false, 'why', 'name too long'); end if;
    insert into pvp_pets (player_id, pet, name) values (pid, 'pet_pilly', nullif(p_name, '')) on conflict (player_id, pet) do update set name = excluded.name, updated = now();
  elsif p_op = 'walk' then
    if not owns or not o then return jsonb_build_object('ok', false, 'why', 'Pilly is not out'); end if;
    if not pvp_rl_hit('pillyw:' || pid, 55, 1) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
    insert into pvp_pets (player_id, pet, xp) values (pid, 'pet_pilly', 1) on conflict (player_id, pet) do update set xp = least(10000, pvp_pets.xp + 1), updated = now();
  elsif p_op = 'treat' then
    if not owns then return jsonb_build_object('ok', false, 'why', 'not your companion'); end if;
    if not pvp_rl_hit('pillyt:' || pid, 60, 20) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
    select xp into x from pvp_pets where player_id = pid and pet = 'pet_pilly' for update; x := coalesce(x, 0); lv := pvp_pet_lv(x);
    if x >= 10000 then return jsonb_build_object('ok', false, 'why', 'max level'); end if;
    cost := 250 * (lv + 1) * (lv + 1);
    g := pvp_pet_gold(pid, -cost); if g is null then return jsonb_build_object('ok', false, 'why', 'not enough gold', 'cost', cost); end if;
    insert into pvp_pets (player_id, pet, xp) values (pid, 'pet_pilly', 100) on conflict (player_id, pet) do update set xp = least(10000, pvp_pets.xp + 100), updated = now();
  elsif p_op <> 'list' then return jsonb_build_object('ok', false, 'why', 'bad operation');
  end if;
  select xp, name into x, nm from pvp_pets where player_id = pid and pet = 'pet_pilly'; x := coalesce(x, 0);
  return jsonb_build_object('ok', true, 'owned', owns, 'out', owns and o, 'xp', x, 'lv', pvp_pet_lv(x), 'name', nm, 'price', price,
    'gold', g, 'cost', cost, 'rev', pvp_pet_rev(pid), 'owner', is_owner);
end $$;
revoke all on function public.pvp_pilly_op(text, text, text, boolean) from public, anon, authenticated;
commit;
