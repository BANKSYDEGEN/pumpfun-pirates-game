-- [scale] Fix 3 runtime checks. Applied on the local embedded Postgres only (never prod).
-- Preconditions: pvp_harbor / pvp_lobby (and seats tables) already exist; 20261114180000 has been applied.
-- Returns rows of (name, ok, detail).

create temporary table scale_lock_results (name text, ok boolean, detail text);

-- 1. peek holds no advisory locks in this backend
begin;
select pvp_harbor_core('scalepeek00001x', 'pfp-harbor', 'peek');
insert into scale_lock_results
select 'peek is lock-free',
       not exists (select 1 from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()),
       (select coalesce(string_agg(objid::text, ','), 'none') from pg_locks where locktype = 'advisory' and pid = pg_backend_pid());
commit;

-- 2. seatless lobby poll holds no advisory locks
begin;
select pvp_lobby_core('scalepoll00001x', 'pfp-pvp-v1', 'poll');
insert into scale_lock_results
select 'seatless poll is lock-free',
       not exists (select 1 from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()),
       (select coalesce(string_agg(objid::text, ','), 'none') from pg_locks where locktype = 'advisory' and pid = pg_backend_pid());
commit;

-- 3. a new harbor beat holds advisory locks (bigint keys split across classid/objid).
begin;
select pvp_harbor_core('scalebeat00001x', 'pfp-harbor', 'beat', 'TEST', null, null);
insert into scale_lock_results
select 'beat holds advisory locks',
       exists (select 1 from pg_locks where locktype = 'advisory' and granted and pid = pg_backend_pid()),
       (select count(*)::text from pg_locks where locktype = 'advisory' and granted and pid = pg_backend_pid());
insert into scale_lock_results
select 'beat does not take the old global harbor key',
       not exists (
         select 1 from pg_locks
         where locktype = 'advisory' and granted and pid = pg_backend_pid()
           and classid = ((hashtext('pvp_harbor')::bigint >> 32) & 4294967295)::oid
           and objid   = (hashtext('pvp_harbor')::bigint & 4294967295)::oid
       ),
       'checked hashtext(pvp_harbor)';
-- keep the result rows; drop the test seat after commit
commit;
delete from pvp_harbor_seats where seat = 'scalebeat00001x';

-- 4. seating behaviour: 8 in one public copy, 9th gets a new copy (or a seat in another), never a 9th in copy 1 when budget allows a split
truncate pvp_harbor_seats, pvp_seats;
do $$
declare i int; r jsonb; c1 int;
begin
  for i in 1..8 loop
    r := pvp_harbor_core('scalehb' || lpad(i::text, 8, '0') || 'xx', 'pfp-harbor', 'beat', 'P' || i, null, 1);
    if (r->>'state') is distinct from 'play' or (r->>'copy')::int is distinct from 1 then
      insert into scale_lock_results values ('first 8 sit in copy 1', false, r::text);
      return;
    end if;
  end loop;
  -- 9th with no want: copy 1 is full (cap 8), so auto-pick opens copy 2 (a singleton has load 0).
  r := pvp_harbor_core('scalehb00000009xx', 'pfp-harbor', 'beat', 'P9', null, null);
  select count(*) into c1 from pvp_harbor_seats where prefix = 'pfp-harbor' and copy = 1 and state = 'play';
  insert into scale_lock_results values (
    '9th pirate does not overflow copy 1',
    c1 = 8 and (r->>'state') = 'play' and (r->>'copy')::int = 2,
    'c1=' || c1 || ' r=' || r::text
  );
end $$;

-- 5. harbor peek after seats reports pirates / copies without needing a seat of our own
do $$
declare r jsonb;
begin
  r := pvp_harbor_core('scalepeek00002x', 'pfp-harbor', 'peek');
  insert into scale_lock_results values (
    'peek reports pirates and copies',
    (r->>'state') = 'peek' and (r->>'pirates')::int = 9 and jsonb_typeof(r->'copies') = 'array',
    r::text
  );
end $$;

-- 6. lobby: first 8 go to play, 9th queues; seatless poll still returns counts
truncate pvp_harbor_seats, pvp_seats;
do $$
declare i int; r jsonb; n int; q int;
begin
  for i in 1..8 loop
    r := pvp_lobby_core('scalelb' || lpad(i::text, 8, '0') || 'xx', 'pfp-pvp-v1', 'play', 'P' || i);
    if (r->>'state') is distinct from 'play' then
      insert into scale_lock_results values ('first 8 play in solo arena', false, r::text);
      return;
    end if;
  end loop;
  r := pvp_lobby_core('scalelb00000009xx', 'pfp-pvp-v1', 'play', 'P9');
  n := (r->>'players')::int; q := (r->>'queue')::int;
  insert into scale_lock_results values (
    '9th queues when arena is full',
    (r->>'state') = 'queue' and n = 8 and q = 1,
    r::text
  );
  r := pvp_lobby_core('scalepoll00002xx', 'pfp-pvp-v1', 'poll');
  insert into scale_lock_results values (
    'seatless poll sees 8 players and 1 queued',
    (r->>'state') = 'harbor' and (r->>'players')::int = 8 and (r->>'queue')::int = 1 and (r->>'cap')::int = 8,
    r::text
  );
end $$;

-- 7. wrappers: peek / seatless poll do not write pvp_rl (if the table exists)
do $$
declare before int; after int; r jsonb;
begin
  if to_regclass('public.pvp_rl') is null then
    insert into scale_lock_results values ('wrappers skip rl on peek/poll', true, 'pvp_rl missing (skipped)');
    return;
  end if;
  select count(*) into before from pvp_rl;
  r := pvp_harbor('scalepeek00003x', 'pfp-harbor', 'peek');
  r := pvp_lobby('scalepoll00003xx', 'pfp-pvp-v1', 'poll');
  select count(*) into after from pvp_rl;
  insert into scale_lock_results values (
    'wrappers skip rl on peek/poll',
    after = before and (select j->>'state' from (select pvp_harbor('scalepeek00003x', 'pfp-harbor', 'peek') as j) t) is not null,
    'before=' || before || ' after=' || after
  );
end $$;

select name, ok, detail from scale_lock_results order by name;
