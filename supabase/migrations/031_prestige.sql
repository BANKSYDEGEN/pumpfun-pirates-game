-- PUMPFUN PIRATES · migration 031 (BANKSY: "Add ability to prestige when max out ship"; "prestige 1 unlock golden gallon and
-- prestige 2 unlock diamond"). Applied with v165 (BANKSY: "Push prestige live"). The free GOLDEN / DIAMOND grant lives in the pvp function (pvp_owned, add only). ADDITIVE ONLY: one new table + one new function. No existing
-- row, column, leaderboard or score is changed or deleted by this migration.
--
-- pvp_prestige: one row per pirate (player_id = the `pvp` function's resolved id, the same key as pvp_owned). `level` = how many
-- times this pirate has prestiged. `log` = the BACKUP: every prestige appends { at, from, levels } (the upgrade levels it reset),
-- so any reset can be put back by hand.
--
-- pvp_prestige_do(): the PRESTIGE action, atomic. Locks the pirate's save row (wallet: pvp_profiles · device / account:
-- pvp_dev_profiles · owner group: pvp_group_saves), checks every upgrade track is at its top level (p_max = { track: top level }),
-- checks the caller saw the current prestige level (p_from: a double tap can't prestige twice), logs the old levels, resets
-- ONLY the save's `upgrades` to base (every track 0) and raises the level by one. Gold, skins, gear, kills, deaths, the boards,
-- pvp_owned: untouched. p_force (owner only, set by the function): skips the "every track maxed" check.
begin;
create table if not exists public.pvp_prestige (
  player_id  text primary key,
  level      integer not null default 0 check (level >= 0 and level <= 100),
  log        jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.pvp_prestige enable row level security;
revoke all on public.pvp_prestige from public, anon, authenticated;  -- service role (the `pvp` function) only

create or replace function public.pvp_prestige_do(p_player text, p_store text, p_store_id text, p_max jsonb, p_from integer, p_force boolean default false)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare lv jsonb; cur integer; k text; zero jsonb := '{}'::jsonb;
begin
  if p_store = 'wallet' then select upgrades into lv from pvp_profiles where id = p_store_id for update;
  elsif p_store = 'dev' then select upgrades into lv from pvp_dev_profiles where id = p_store_id for update;
  elsif p_store = 'group' then select upgrades into lv from pvp_group_saves where main = p_store_id for update;
  else return jsonb_build_object('ok', false, 'why', 'bad store'); end if;
  if not found then return jsonb_build_object('ok', false, 'why', 'no save yet'); end if;
  lv := coalesce(lv, '{}'::jsonb);
  insert into pvp_prestige (player_id) values (p_player) on conflict (player_id) do nothing;
  select level into cur from pvp_prestige where player_id = p_player for update;
  if cur <> coalesce(p_from, -1) then return jsonb_build_object('ok', false, 'why', 'prestige changed', 'level', cur); end if;
  if cur >= 100 then return jsonb_build_object('ok', false, 'why', 'top prestige', 'level', cur); end if;
  for k in select jsonb_object_keys(p_max) loop
    if not coalesce(p_force, false) and coalesce((lv->>k)::int, 0) < (p_max->>k)::int then
      return jsonb_build_object('ok', false, 'why', 'not maxed', 'level', cur, 'levels', lv);
    end if;
    zero := zero || jsonb_build_object(k, 0);
  end loop;
  update pvp_prestige set level = cur + 1, updated_at = now(),
    log = log || jsonb_build_array(jsonb_build_object('at', now(), 'from', cur, 'store', p_store, 'levels', lv)) where player_id = p_player;
  if p_store = 'wallet' then update pvp_profiles set upgrades = zero, updated_at = now() where id = p_store_id;
  elsif p_store = 'dev' then update pvp_dev_profiles set upgrades = zero, updated_at = now() where id = p_store_id;
  else update pvp_group_saves set upgrades = zero where main = p_store_id; end if;  -- updated_at kept: it paces the owner's gold
  return jsonb_build_object('ok', true, 'level', cur + 1, 'levels', zero, 'backup', lv);
end $function$;
revoke all on function public.pvp_prestige_do(text, text, text, jsonb, integer, boolean) from public, anon, authenticated;
commit;

-- ROLLBACK (only if no one has prestiged yet; otherwise keep the table: it holds the levels + the backups):
-- begin; drop function if exists public.pvp_prestige_do(text, text, text, jsonb, integer, boolean); drop table if exists public.pvp_prestige; commit;
