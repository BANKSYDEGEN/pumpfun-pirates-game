-- [join-queue] BANKSY t2505u "Add the join queue too" (extend the v577 SEAS ARE CROWDED gate).
-- One config value: pvp_scale_config.world_cap (default 120). Raise this after a plan upgrade.
-- 120 leaves headroom under the Free-plan Realtime limit of 200 connections, and bounds
-- in-world DB/edge load (title-screen waiters stay cheap). Admins (BANKSY / owner) bypass the cap.
-- Title-screen poll/leave and in-world beat share this table. Stale rows expire after 135 s
-- (longer than the v577 60 s backoff, so a waiting client keeps its place). Peek/poll of an
-- already-queued row is lock-free except for a short try-lock around admission and GC.
-- Service-role only (the pvp edge function). Idempotent.

begin;

create table if not exists public.pvp_scale_config (
  id int primary key default 1 check (id = 1),
  world_cap int not null default 120 check (world_cap between 1 and 100000)
);
comment on table public.pvp_scale_config is
  'Single-row scale knobs. world_cap is the global in-world join cap; raise it when servers are upgraded.';
comment on column public.pvp_scale_config.world_cap is
  'Max admitted in-world pirates (title-screen join gate). Default 120 (Free plan, under Realtime 200). One value to raise later.';
insert into public.pvp_scale_config (id, world_cap) values (1, 120)
  on conflict (id) do nothing;

create table if not exists public.pvp_join_queue (
  pid text primary key,
  enqueued_at timestamptz not null default now(),
  seen_at timestamptz not null default now(),
  admitted boolean not null default false
);
comment on table public.pvp_join_queue is
  'Title-screen join queue + in-world leases for the v577 SEAS ARE CROWDED gate. Stale after 135 s.';
create index if not exists pvp_join_queue_wait_idx
  on public.pvp_join_queue (enqueued_at, pid) where not admitted;
create index if not exists pvp_join_queue_seen_idx
  on public.pvp_join_queue (seen_at);

alter table public.pvp_scale_config enable row level security;
alter table public.pvp_join_queue enable row level security;
revoke all on table public.pvp_scale_config from public, anon, authenticated;
revoke all on table public.pvp_join_queue from public, anon, authenticated;

create or replace function public.pvp_join_gate(p_pid text, p_op text default 'poll', p_owner boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cap int;
  occupied int;
  waiting int;
  free int;
  stale constant interval := interval '135 seconds';
  me public.pvp_join_queue;
  ahead int;
  pos int;
begin
  if p_pid is null or length(btrim(p_pid)) < 1 or length(p_pid) > 120 then
    return jsonb_build_object('ok', false, 'why', 'bad pid');
  end if;
  p_pid := left(btrim(p_pid), 120);
  if p_op is null or p_op not in ('poll', 'beat', 'leave') then
    return jsonb_build_object('ok', false, 'why', 'bad op');
  end if;

  if pg_try_advisory_xact_lock(hashtext('pvp_join_gate_gc')) then
    delete from pvp_join_queue where seen_at < now() - stale;
  end if;

  select world_cap into cap from pvp_scale_config where id = 1;
  cap := greatest(1, coalesce(cap, 120));

  if p_op = 'leave' then
    delete from pvp_join_queue where pid = p_pid;
    select count(*)::int into occupied from pvp_join_queue where admitted and seen_at >= now() - stale;
    select count(*)::int into waiting from pvp_join_queue where not admitted and seen_at >= now() - stale;
    return jsonb_build_object('ok', true, 'state', 'leave', 'cap', cap, 'in_world', occupied, 'queue', waiting, 'pos', 0, 'ahead', 0);
  end if;

  if p_op = 'beat' then
    -- In-world heartbeat: upsert an admitted lease (covers sailors already in before this gate shipped).
    insert into pvp_join_queue (pid, enqueued_at, seen_at, admitted)
    values (p_pid, now(), now(), true)
    on conflict (pid) do update set seen_at = now(), admitted = true;
    select count(*)::int into occupied from pvp_join_queue where admitted and seen_at >= now() - stale;
    select count(*)::int into waiting from pvp_join_queue where not admitted and seen_at >= now() - stale;
    return jsonb_build_object('ok', true, 'state', 'enter', 'cap', cap, 'in_world', occupied, 'queue', waiting, 'pos', 0, 'ahead', 0, 'owner', coalesce(p_owner, false));
  end if;

  -- poll: enqueue or refresh seen_at (keep place in line and admitted state)
  insert into pvp_join_queue (pid, enqueued_at, seen_at, admitted)
  values (p_pid, now(), now(), false)
  on conflict (pid) do update set seen_at = now();

  if coalesce(p_owner, false) then
    update pvp_join_queue set admitted = true, seen_at = now() where pid = p_pid;
  elsif pg_try_advisory_xact_lock(hashtext('pvp_join_gate_admit')) then
    select count(*)::int into occupied from pvp_join_queue where admitted and seen_at >= now() - stale;
    free := cap - occupied;
    if free > 0 then
      update pvp_join_queue q
      set admitted = true, seen_at = now()
      from (
        select pid from pvp_join_queue
        where not admitted and seen_at >= now() - stale
        order by enqueued_at, pid
        limit free
      ) s
      where q.pid = s.pid;
    end if;
  end if;

  select * into me from pvp_join_queue where pid = p_pid;
  select count(*)::int into occupied from pvp_join_queue where admitted and seen_at >= now() - stale;
  select count(*)::int into waiting from pvp_join_queue where not admitted and seen_at >= now() - stale;

  if me.admitted then
    return jsonb_build_object('ok', true, 'state', 'enter', 'cap', cap, 'in_world', occupied, 'queue', waiting, 'pos', 0, 'ahead', 0, 'owner', coalesce(p_owner, false));
  end if;

  select count(*)::int into ahead
  from pvp_join_queue
  where not admitted and seen_at >= now() - stale
    and (enqueued_at < me.enqueued_at or (enqueued_at = me.enqueued_at and pid < me.pid));
  pos := ahead + 1;

  return jsonb_build_object(
    'ok', true, 'state', 'wait',
    'cap', cap, 'in_world', occupied,
    'queue', waiting, 'pos', pos, 'ahead', ahead,
    'owner', coalesce(p_owner, false)
  );
end;
$$;

revoke all on function public.pvp_join_gate(text, text, boolean) from public, anon, authenticated;
grant all on table public.pvp_scale_config to service_role;
grant all on table public.pvp_join_queue to service_role;
grant execute on function public.pvp_join_gate(text, text, boolean) to service_role;

commit;
