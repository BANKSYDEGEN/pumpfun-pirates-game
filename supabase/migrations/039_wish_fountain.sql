-- [wish] THE WISHING FOUNTAIN (BANKSY: a hidden feature at the hill roundabout fountain). Toss 100 gold = a quiet 5-minute luck window on
-- chest digs (the Edge Function tilts the chest table while pvp_wish_lucky is true; chest.ts WISH). Nothing on screen says so.
-- ADDITIVE: one new flag (OFF), one new table, two new functions. No existing row, table or function changes. Gold moves exactly like
-- pvp_shop_buy (022): the server save, shop_rev + 1, an idempotent pvp_purchases row (item 'wish:fountain', never put in pvp_owned).
-- ROLLBACK: update pvp_flags set on_ = false where k = 'wish_fountain' (tosses close, nobody is lucky any more).
begin;
insert into public.pvp_flags (k, on_, note) values ('wish_fountain', false, 'roundabout wishing fountain (hidden 5 min luck, 100 gold)') on conflict (k) do nothing;
create table if not exists public.pvp_wish (
  player_id  text primary key,
  until_at   timestamptz not null,
  tosses     integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.pvp_wish enable row level security;
revoke all on public.pvp_wish from public, anon, authenticated;

create or replace function public.pvp_wish_toss(p_player text, p_req text, p_price integer, p_minutes integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text := public.pvp_main(p_player); g integer; rv integer; prev pvp_purchases; is_wallet boolean := pid like 'wallet:%';
  mins integer := least(greatest(coalesce(p_minutes, 5), 1), 10);
begin
  if p_price is null or p_price < 0 or p_req is null or pid is null then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
  if not pvp_flag('wish_fountain') then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  select * into prev from pvp_purchases where req = p_req;
  if found then
    if prev.player_id <> pid then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
    return jsonb_build_object('ok', true, 'gold', prev.gold_after, 'rev', prev.rev, 'retry', true);
  end if;
  if exists (select 1 from pvp_wish where player_id = pid and updated_at > now() - interval '4 seconds') then return jsonb_build_object('ok', false, 'why', 'slow down'); end if; -- 4 s between tosses
  if not pvp_rl_hit('wish:' || pid, 60, 6) then return jsonb_build_object('ok', false, 'why', 'slow down'); end if;
  if pid = 'dev:e191a32e15abea4f14355121' then -- owner: free (everything is), the wish still counts
    insert into pvp_wish (player_id, until_at, tosses) values (pid, now() + make_interval(mins => mins), 1)
      on conflict (player_id) do update set until_at = excluded.until_at, tosses = pvp_wish.tosses + 1, updated_at = now();
    return jsonb_build_object('ok', true, 'owner', true);
  end if;
  if is_wallet then select gold, shop_rev into g, rv from pvp_profiles where id = pid for update;
  else select gold, shop_rev into g, rv from pvp_dev_profiles where id = pid for update; end if;
  if not found then return jsonb_build_object('ok', false, 'why', 'no save yet'); end if;
  if g < p_price then return jsonb_build_object('ok', false, 'why', 'not enough gold', 'gold', g); end if;
  rv := rv + 1;
  if is_wallet then update pvp_profiles set gold = g - p_price, shop_rev = rv where id = pid;
  else update pvp_dev_profiles set gold = g - p_price, shop_rev = rv where id = pid; end if;
  insert into pvp_purchases (player_id, req, item, price, gold_before, gold_after, rev) values (pid, p_req, 'wish:fountain', p_price, g, g - p_price, rv);
  insert into pvp_wish (player_id, until_at, tosses) values (pid, now() + make_interval(mins => mins), 1)
    on conflict (player_id) do update set until_at = excluded.until_at, tosses = pvp_wish.tosses + 1, updated_at = now(); -- a new wish restarts the 5 min (no stacking)
  return jsonb_build_object('ok', true, 'gold', g - p_price, 'rev', rv);
end $$;
revoke all on function public.pvp_wish_toss(text, text, integer, integer) from public, anon, authenticated;

create or replace function public.pvp_wish_lucky(p_player text) returns boolean language sql stable security definer set search_path = public as $$
  select pvp_flag('wish_fountain') and exists (select 1 from pvp_wish where player_id = public.pvp_main(p_player) and until_at > now()) $$;
revoke all on function public.pvp_wish_lucky(text) from public, anon, authenticated;
commit;
