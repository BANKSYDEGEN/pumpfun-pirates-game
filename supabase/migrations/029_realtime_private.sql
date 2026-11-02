-- PUMPFUN PIRATES · migration 029 (security fix M1, SECURITY_FIXES.md). APPLIED to production 2026-11-02 (with RLS already on).
-- Private Realtime channels for PvP. The `pvp` Edge Function's `ticket` action hands a seated pirate a short-lived JWT
-- (role authenticated, claims pfp_topic + pfp_net) signed with the project JWT secret (function secret PFP_RT_JWT_SECRET).
-- These policies let such a token join, read and broadcast on THAT ONE channel only.
-- Harmless on its own: public channels keep working until "Allow public access" is switched OFF in
-- Dashboard -> Realtime -> Settings, which must wait until every player runs the new client (SECURITY_FIXES.md, step 6).
begin;
-- realtime.messages is owned by supabase_realtime_admin, and RLS is already on in hosted projects; the SQL editor role can't
-- ALTER it ("must be owner"), so only enable it when it is off.
do $$ begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'realtime' and c.relname = 'messages' and not c.relrowsecurity) then
    alter table realtime.messages enable row level security;
  end if;
end $$;

drop policy if exists "pfp ticket can read its channel" on realtime.messages;
create policy "pfp ticket can read its channel" on realtime.messages
  for select to authenticated
  using (realtime.messages.extension = 'broadcast' and (select realtime.topic()) = (select auth.jwt() ->> 'pfp_topic'));

drop policy if exists "pfp ticket can broadcast on its channel" on realtime.messages;
create policy "pfp ticket can broadcast on its channel" on realtime.messages
  for insert to authenticated
  with check (realtime.messages.extension = 'broadcast' and (select realtime.topic()) = (select auth.jwt() ->> 'pfp_topic'));
commit;

-- ROLLBACK: turn "Allow public access" back ON first (old behaviour), then
--   drop policy if exists "pfp ticket can read its channel" on realtime.messages;
--   drop policy if exists "pfp ticket can broadcast on its channel" on realtime.messages;
