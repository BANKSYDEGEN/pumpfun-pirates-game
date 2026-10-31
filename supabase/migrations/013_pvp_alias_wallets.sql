-- v75 (additive / corrective only; nothing deleted):
--  * pvp_alias: one pirate playing on several devices. A device id that is an alias of another records its kills under the
--    main id (mapped in the `pvp` function) and its existing rows are re-pointed (UPDATE of the id column only).
--    Set server-side only (owner-confirmed), never from the client.
--  * pvp_kills_top now also returns the SHORT wallet the player saved in the name/wallet pop-up (pvp_airdrop), or the
--    signed wallet for wallet: ids; same 'abcd...vwxyz' format as the Waves board. Never the full address.
create table if not exists public.pvp_alias (
  dev        text primary key check (dev ~ '^dev:[0-9a-f]{24}$'),
  main       text not null check (main ~ '^(wallet:[1-9A-HJ-NP-Za-km-z]{32,44}|dev:[0-9a-f]{24})$'),
  note       text,
  created_at timestamptz not null default now()
);
alter table public.pvp_alias enable row level security;
revoke all on public.pvp_alias from anon, authenticated;

create or replace function public.pvp_short_wallet(w text) returns text language sql immutable as $$
  select case when w is null or w = '' then null when char_length(w) > 12 then left(w, 4) || '...' || right(w, 5) else w end;
$$;

drop function if exists public.pvp_kills_top(text, integer);
create function public.pvp_kills_top(p_period text, p_limit integer)
returns table(player text, name text, kills bigint, deaths bigint, wallet text)
language sql stable security definer set search_path = public as $$
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
         p.name, k.kills, coalesce(d.deaths, 0),
         pvp_short_wallet(coalesce((select a.wallet from pvp_airdrop a where a.player_id = k.id),
                                   (select a.wallet from pvp_airdrop a join pvp_alias x on x.dev = a.player_id where x.main = k.id order by a.updated_at desc limit 1),
                                   case when k.id like 'wallet:%' then substr(k.id, 8) end))
  from k join pvp_players p on p.id = k.id left join d on d.id = k.id
  order by k.kills desc, coalesce(d.deaths, 0) asc, p.updated_at asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;
grant execute on function public.pvp_kills_top(text, integer) to anon, authenticated, service_role;

-- BANKSY (owner-confirmed, 3:08 PM): devices 'BANKSY' (dev:c53d…) and 'BANKSY2/BANKSYDEGEN' (dev:e191…) are one pirate
-- (same saved wallet). Re-point the alias device's rows to the main id (no self-kills exist between them).
insert into public.pvp_alias (dev, main, note) values ('dev:c53da939472a7ae23f6dd873', 'dev:e191a32e15abea4f14355121', 'BANKSY: same owner, both devices')
  on conflict (dev) do nothing;
update public.pvp_kills set killer_id = a.main from public.pvp_alias a where pvp_kills.killer_id = a.dev and pvp_kills.victim_id <> a.main;
update public.pvp_kills set victim_id = a.main from public.pvp_alias a where pvp_kills.victim_id = a.dev and pvp_kills.killer_id <> a.main;
