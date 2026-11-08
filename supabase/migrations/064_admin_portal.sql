-- BANKSY owner-only ADMIN PORTAL. Additive; no balances/gameplay changed.
-- Deploy this migration BEFORE the updated pvp edge function. No public RPC access.
begin;
alter table public.pvp_admin_presence add column if not exists device text;
alter table public.pvp_admin_presence add column if not exists session_started_at timestamptz;

create or replace function public.pvp_admin_live(p_owner text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if p_owner is distinct from public.pvp_inv_owner() then
    return jsonb_build_object('ok', false, 'why', 'owner only');
  end if;
  with profiles as (
    select id, gold, updated_at from pvp_profiles
    union all select id, gold, updated_at from pvp_dev_profiles
  ), canonical as (
    select distinct on (pvp_main(id)) pvp_main(id) as pid, gold
    from profiles order by pvp_main(id), updated_at desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'net', p.net_id, 'gold', coalesce(g.gold, c.gold),
    'device', p.device, 'session_started_at', p.session_started_at,
    'seen_at', p.updated_at)), '[]'::jsonb) into result
  from pvp_admin_presence p left join canonical c on c.pid = p.pid
  left join pvp_group_saves g on g.main = p.pid
  where p.updated_at > now() - interval '45 seconds';
  return jsonb_build_object('ok', true, 'players', result);
end $$;
revoke all on function public.pvp_admin_live(text) from public, anon, authenticated;
grant execute on function public.pvp_admin_live(text) to service_role;

create or replace function public.pvp_admin_stats(p_owner text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if p_owner is distinct from public.pvp_inv_owner() then
    return jsonb_build_object('ok', false, 'why', 'owner only');
  end if;
  with profiles as (
    select id, gold, created_at, updated_at from pvp_profiles
    union all select id, gold, created_at, updated_at from pvp_dev_profiles
  ), canonical as (
    select distinct on (pvp_main(id)) pvp_main(id) as pid, gold
    from profiles order by pvp_main(id), updated_at desc
  ), balances as (
    select c.pid, coalesce(g.gold, c.gold)::bigint as gold from canonical c
    left join pvp_group_saves g on g.main = c.pid
    union all select g.main, g.gold::bigint from pvp_group_saves g
    where not exists (select 1 from canonical c where c.pid = g.main)
  ), first_seen as (
    select pvp_main(id) as pid, min(created_at) as first_at from profiles group by 1
  ), activity as (
    select pvp_main(id) as pid, updated_at as at from profiles
    union all select pvp_main(id), updated_at from pvp_players
    union all select main, updated_at from pvp_group_saves
  ), last_seen as (
    select pid, max(at) as at from activity group by pid
  ), recent_shop as (
    select item, count(*) as purchases, sum(price) as gold from pvp_purchases
    where created_at >= now() - interval '30 days' and item not like 'casino:%'
    group by item order by count(*) desc, item limit 8
  ), held as (
    select item, sum(qty) as quantity from pvp_inv group by item
    order by sum(qty) desc, item limit 8
  )
  select jsonb_build_object(
    'ok', true, 'at', now(), 'timezone', 'America/Indiana/Indianapolis',
    'identities', (select count(*) from first_seen),
    -- Latest timestamp proxies, NOT true DAU/WAU/MAU: no historical login log exists.
    'seen_today', (select count(*) from last_seen where at >= date_trunc('day', now() at time zone 'America/Indiana/Indianapolis') at time zone 'America/Indiana/Indianapolis'),
    'seen_7d', (select count(*) from last_seen where at >= now() - interval '7 days'),
    'seen_30d', (select count(*) from last_seen where at >= now() - interval '30 days'),
    'new_today', (select count(*) from first_seen where first_at >= date_trunc('day', now() at time zone 'America/Indiana/Indianapolis') at time zone 'America/Indiana/Indianapolis'),
    'new_7d', (select count(*) from first_seen where first_at >= now() - interval '7 days'),
    'new_30d', (select count(*) from first_seen where first_at >= now() - interval '30 days'),
    'saved_gold', (select coalesce(sum(gold),0) from balances),
    'pending_gold', (select coalesce(sum(gold),0) from pvp_inv_owner_pot),
    'kills_30d', (select count(*) from pvp_kills where created_at >= now() - interval '30 days'),
    'kills_total', (select count(*) from pvp_kills),
    'purchases_30d', (select count(*) from pvp_purchases where created_at >= now() - interval '30 days' and item not like 'casino:%'),
    'shop_gold_30d', (select coalesce(sum(price),0) from pvp_purchases where created_at >= now() - interval '30 days' and item not like 'casino:%'),
    'casino_bets_30d', (select count(*) from pvp_purchases where created_at >= now() - interval '30 days' and item like 'casino:%'),
    'casino_staked_30d', (select coalesce(sum(price),0) from pvp_purchases where created_at >= now() - interval '30 days' and item like 'casino:%'),
    'top_purchases', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from recent_shop s),
    'top_held', (select coalesce(jsonb_agg(to_jsonb(h)), '[]'::jsonb) from held h)
  ) into result;
  return result;
end $$;
revoke all on function public.pvp_admin_stats(text) from public, anon, authenticated;
grant execute on function public.pvp_admin_stats(text) to service_role;
commit;
