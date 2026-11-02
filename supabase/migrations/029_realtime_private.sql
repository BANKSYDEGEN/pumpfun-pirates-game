-- PUMPFUN PIRATES · migration 029 (security fix M1, SECURITY_FIXES.md). NOT APPLIED: written for review.
-- Private Realtime channels for PvP. The `pvp` Edge Function's `ticket` action hands a seated pirate a short-lived JWT
-- (role authenticated, claims pfp_topic + pfp_net) signed with the project JWT secret (function secret PFP_RT_JWT_SECRET).
-- These policies let such a token join, read and broadcast on THAT ONE channel only.
-- Harmless on its own: public channels keep working until "Allow public access" is switched OFF in
-- Dashboard -> Realtime -> Settings, which must wait until every player runs the new client (SECURITY_FIXES.md, step 6).
begin;
alter table if exists realtime.messages enable row level security;

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
