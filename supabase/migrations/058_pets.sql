-- PUMPFUN PIRATES · migration 058 (BANKSY: pet names + upgrades / leveling + pet trading; trades server-side, two-sided, anti-dupe).
-- pvp_pets: one row per (player, pet) with its name + xp. Level = floor(sqrt(xp / 100)), max 10 (xp 10000).
-- XP: +5 per 'walk' tick (rate-limited 1 per 55 s while the pet is out) or TREATS bought with gold (+100 xp, price grows with level).
-- Trades: the seller offers a pet they OWN (pvp_owned row) to a named pirate for a gold price; the buyer accepts -> ONE transaction:
-- lock the offer + both gold rows, re-check the seller still owns it and the buyer doesn't, move the pvp_owned row + the pet's name/xp,
-- move the gold. The offer is single-use (status). The owner's test kit (owns everything by rule) cannot sell. Service-role only.
begin;

create table if not exists public.pvp_pets (
  player_id text not null,
  pet       text not null check (pet ~ '^pet_[a-z0-9_]{2,20}$'),
  name      text check (name is null or char_length(name) between 1 and 16),
  xp        integer not null default 0 check (xp between 0 and 10000),
  updated   timestamptz not null default now(),
  primary key (player_id, pet)
);
create table if not exists public.pvp_pet_offers (
  id        bigserial primary key,
  seller_id text not null,
  buyer_id  text not null,
  pet       text not null check (pet ~ '^pet_[a-z0-9_]{2,20}$'),
  price     integer not null check (price between 0 and 10000000),
  status    text not null default 'open' check (status in ('open', 'done', 'declined', 'cancelled', 'void')),
  created   timestamptz not null default now(),
  check (seller_id <> buyer_id)
);
create index if not exists pvp_pet_offers_buyer on public.pvp_pet_offers (buyer_id) where status = 'open';
create index if not exists pvp_pet_offers_seller on public.pvp_pet_offers (seller_id) where status = 'open';
alter table public.pvp_pets enable row level security;
alter table public.pvp_pet_offers enable row level security;
revoke all on public.pvp_pets, public.pvp_pet_offers from anon, authenticated;

create or replace function public.pvp_pet_lv(p_xp integer) returns integer language sql immutable as $$
  select least(10, floor(sqrt(greatest(coalesce(p_xp, 0), 0) / 100.0))::integer) $$;

-- gold delta for one player (owner = his shared pot). Returns the new gold, or null when it would go below 0 / no save.
create or replace function public.pvp_pet_gold(p_pid text, p_delta integer) returns integer
language plpgsql security definer set search_path = public as $$
declare g integer;
begin
  if p_pid = public.pvp_inv_owner() then
    insert into pvp_group_saves (main) values (p_pid) on conflict (main) do nothing;
    select gold into g from pvp_group_saves where main = p_pid for update;
    if coalesce(g, 0) + p_delta < 0 then return null; end if;
    update pvp_group_saves set gold = least(10000000, coalesce(gold, 0) + p_delta) where main = p_pid returning gold into g; return g;
  elsif p_pid like 'wallet:%' then
    select gold into g from pvp_profiles where id = p_pid for update; if not found or g + p_delta < 0 then return null; end if;
    update pvp_profiles set gold = least(10000000, g + p_delta), shop_rev = coalesce(shop_rev, 0) + 1 where id = p_pid returning gold into g; return g;
  else
    select gold into g from pvp_dev_profiles where id = p_pid for update; if not found or g + p_delta < 0 then return null; end if;
    update pvp_dev_profiles set gold = least(10000000, g + p_delta), shop_rev = coalesce(shop_rev, 0) + 1 where id = p_pid returning gold into g; return g;
  end if;
end $$;

create or replace function public.pvp_pet_rev(p_pid text) returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select shop_rev from pvp_profiles where id = p_pid and p_pid like 'wallet:%'), (select shop_rev from pvp_dev_profiles where id = p_pid), 0) $$;
revoke all on function public.pvp_pet_rev(text) from public, anon, authenticated;

create or replace function public.pvp_pet_op(p_player text, p_op text, p_pet text default null, p_name text default null,
  p_other text default null, p_price integer default null, p_offer bigint default null, p_accept boolean default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); is_owner boolean := pid = public.pvp_inv_owner();
  owns boolean; x integer; lv integer; cost integer; g integer; o pvp_pet_offers; other text; r pvp_pets;
begin
  if p_pet is not null and p_pet !~ '^pet_[a-z0-9_]{2,20}$' then return jsonb_build_object('ok', false, 'why', 'bad pet'); end if;
  owns := is_owner or (p_pet is not null and exists (select 1 from pvp_owned where player_id = pid and item = 'gear:parrot:' || p_pet));

  if p_op = 'list' then
    return jsonb_build_object('ok', true,
      'pets', coalesce((select jsonb_agg(jsonb_build_object('pet', k.pet, 'name', p.name, 'xp', coalesce(p.xp, 0), 'lv', pvp_pet_lv(coalesce(p.xp, 0))))
        from (select substr(w.item, 13) as pet from pvp_owned w where w.player_id = pid and w.item like 'gear:parrot:pet\_%'
              union select q.pet from pvp_pets q where is_owner and q.player_id = pid) k
        left join pvp_pets p on p.player_id = pid and p.pet = k.pet), '[]'::jsonb),
      'owner', is_owner,
      'incoming', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'pet', f.pet, 'price', f.price, 'from', coalesce(pl.name, 'PIRATE')) order by f.id desc)
        from pvp_pet_offers f left join pvp_players pl on pl.id = f.seller_id where f.buyer_id = pid and f.status = 'open' and f.created > now() - interval '1 day'), '[]'::jsonb),
      'outgoing', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'pet', f.pet, 'price', f.price, 'to', coalesce(pl.name, 'PIRATE')) order by f.id desc)
        from pvp_pet_offers f left join pvp_players pl on pl.id = f.buyer_id where f.seller_id = pid and f.status = 'open' and f.created > now() - interval '1 day'), '[]'::jsonb));
  end if;

  if p_op = 'name' then
    if not owns then return jsonb_build_object('ok', false, 'why', 'not your pet'); end if;
    insert into pvp_pets (player_id, pet, name) values (pid, p_pet, nullif(p_name, '')) on conflict (player_id, pet) do update set name = excluded.name, updated = now();
    return jsonb_build_object('ok', true, 'pet', p_pet, 'name', nullif(p_name, ''));
  end if;

  if p_op = 'walk' then
    if not owns then return jsonb_build_object('ok', false, 'why', 'not your pet'); end if;
    if not pvp_rl_hit('petw:' || pid, 55, 1) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
    insert into pvp_pets (player_id, pet, xp) values (pid, p_pet, 5) on conflict (player_id, pet) do update set xp = least(10000, pvp_pets.xp + 5), updated = now() returning xp into x;
    return jsonb_build_object('ok', true, 'pet', p_pet, 'xp', x, 'lv', pvp_pet_lv(x));
  end if;

  if p_op = 'treat' then
    if not owns then return jsonb_build_object('ok', false, 'why', 'not your pet'); end if;
    if not pvp_rl_hit('pett:' || pid, 60, 20) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
    select xp into x from pvp_pets where player_id = pid and pet = p_pet for update; x := coalesce(x, 0); lv := pvp_pet_lv(x);
    if x >= 10000 then return jsonb_build_object('ok', false, 'why', 'max level'); end if;
    cost := 250 * (lv + 1) * (lv + 1);
    g := pvp_pet_gold(pid, -cost); if g is null then return jsonb_build_object('ok', false, 'why', 'not enough gold', 'cost', cost); end if;
    insert into pvp_pets (player_id, pet, xp) values (pid, p_pet, 100) on conflict (player_id, pet) do update set xp = least(10000, pvp_pets.xp + 100), updated = now() returning xp into x;
    return jsonb_build_object('ok', true, 'pet', p_pet, 'xp', x, 'lv', pvp_pet_lv(x), 'gold', g, 'cost', cost, 'rev', pvp_pet_rev(pid), 'owner', is_owner);
  end if;

  if p_op = 'offer' then
    if is_owner then return jsonb_build_object('ok', false, 'why', 'the house pets cannot be sold'); end if;
    if not owns then return jsonb_build_object('ok', false, 'why', 'not your pet'); end if;
    if not pvp_rl_hit('peto:' || pid, 600, 20) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
    select id into other from pvp_players where lower(name) = lower(p_name) limit 1;
    if other is null then return jsonb_build_object('ok', false, 'why', 'no pirate with that name'); end if;
    other := public.pvp_main(other); if other = pid then return jsonb_build_object('ok', false, 'why', 'that is you'); end if;
    if other = public.pvp_inv_owner() or exists (select 1 from pvp_owned where player_id = other and item = 'gear:parrot:' || p_pet) then return jsonb_build_object('ok', false, 'why', 'they already have that pet'); end if;
    if exists (select 1 from pvp_pet_offers where seller_id = pid and pet = p_pet and status = 'open') then return jsonb_build_object('ok', false, 'why', 'that pet is already offered'); end if;
    insert into pvp_pet_offers (seller_id, buyer_id, pet, price) values (pid, other, p_pet, least(greatest(coalesce(p_price, 0), 0), 10000000)) returning * into o;
    return jsonb_build_object('ok', true, 'id', o.id);
  end if;

  if p_op = 'cancel' then
    update pvp_pet_offers set status = 'cancelled' where id = p_offer and seller_id = pid and status = 'open';
    return jsonb_build_object('ok', found);
  end if;

  if p_op = 'respond' then
    select * into o from pvp_pet_offers where id = p_offer and buyer_id = pid for update;
    if not found or o.status <> 'open' then return jsonb_build_object('ok', false, 'why', 'that offer is gone'); end if;
    if not coalesce(p_accept, false) then update pvp_pet_offers set status = 'declined' where id = o.id; return jsonb_build_object('ok', true, 'state', 'declined'); end if;
    if o.created < now() - interval '1 day' then update pvp_pet_offers set status = 'void' where id = o.id; return jsonb_build_object('ok', false, 'why', 'that offer expired'); end if;
    perform 1 from pvp_owned where player_id = o.seller_id and item = 'gear:parrot:' || o.pet for update;
    if not found then update pvp_pet_offers set status = 'void' where id = o.id; return jsonb_build_object('ok', false, 'why', 'they no longer have that pet'); end if;
    if is_owner or exists (select 1 from pvp_owned where player_id = pid and item = 'gear:parrot:' || o.pet) then return jsonb_build_object('ok', false, 'why', 'you already have that pet'); end if;
    if o.price > 0 then
      g := pvp_pet_gold(pid, -o.price); if g is null then return jsonb_build_object('ok', false, 'why', 'not enough gold'); end if;
      if pvp_pet_gold(o.seller_id, o.price) is null then raise exception 'seller gold'; end if;
    end if;
    delete from pvp_owned where player_id = o.seller_id and item = 'gear:parrot:' || o.pet;
    insert into pvp_owned (player_id, item, source, price) values (pid, 'gear:parrot:' || o.pet, 'grant', o.price);
    select * into r from pvp_pets where player_id = o.seller_id and pet = o.pet for update;
    if found then
      delete from pvp_pets where player_id = o.seller_id and pet = o.pet;
      insert into pvp_pets (player_id, pet, name, xp) values (pid, o.pet, r.name, r.xp) on conflict (player_id, pet) do update set name = excluded.name, xp = excluded.xp, updated = now();
    end if;
    update pvp_pet_offers set status = 'done' where id = o.id;
    update pvp_pet_offers set status = 'void' where seller_id = o.seller_id and pet = o.pet and status = 'open';
    return jsonb_build_object('ok', true, 'state', 'done', 'pet', o.pet, 'gold', g, 'rev', pvp_pet_rev(pid), 'owner', false);
  end if;
  return jsonb_build_object('ok', false, 'why', 'unknown');
end $$;
revoke all on function public.pvp_pet_op(text, text, text, text, text, integer, bigint, boolean) from public, anon, authenticated;
revoke all on function public.pvp_pet_gold(text, integer) from public, anon, authenticated;
commit;
