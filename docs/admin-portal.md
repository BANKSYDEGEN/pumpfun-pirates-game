# BANKSY Admin Portal

Open **Settings → Admin Menu → ADMIN PORTAL** (server-confirmed owner only).
The full-screen panel is lazy-loaded. It polls the existing owner roster every
5 seconds while visible, and aggregates every minute. Closing it stops polling.
The chart uses the existing island terrain bake and harbor-to-foot transform.
Arena / house / hull coordinates are not plotted on the outdoor map.

## Server rollout (requires BANKSY approval)

1. Back up the current functions/schema first.
2. Apply `supabase/migrations/064_admin_portal.sql`.
   - Adds nullable coarse device and reported page-session-start metadata to the
     already-private `pvp_admin_presence` table.
   - Adds `pvp_admin_live(p_owner text)` for fresh-session gold/device/duration.
   - Adds `pvp_admin_stats(p_owner text)` for existing-data aggregates.
   - Both functions require `p_owner = pvp_inv_owner()` and revoke public, anon
     and authenticated execution; only the service role can call them.
   - No balances, inventories, gameplay rules or existing player data are changed.
3. Deploy the `pvp` edge function from current main. The changes are in
   `supabase/functions/pvp/admin.ts`: owner-only `admin_stats`, richer
   `admin_players` when `portal: true`, optional own-session heartbeat metadata.
   Existing `index.ts` routes `ADMIN_ACTIONS` automatically. The edge checks
   `whoAmI().owner` before either data action, and supplies the verified pid to SQL.

Until then, the client shows the existing live roster + shared island/sea chart;
analytics say **Server update pending**, and device/session/gold may be unknown.
The chart becomes available after Harbor has loaded.

## Metric definitions / limitations

- Last seen today / 7d / 30d: unique canonical linked identities by their latest
  profile / leaderboard / group-save timestamp. These are activity proxies, NOT
  true historical DAU / WAU / MAU. Today is America/Indiana/Indianapolis midnight.
- New saves: first profile creation per canonical linked identity, not necessarily
  a new person. New-save counts today / 7d / 30d are shown.
- Saved gold: latest canonical profile balance, with group-save balances taking
  precedence (no duplicate linked-device copies). Inventory-pot gold is separate;
  unsynced device balances are not known to the server.
- Kills: recorded `pvp_kills` rows, 30d and all time.
- Shop: `pvp_purchases` excluding `casino:%`, 30d count/spend/top purchases.
- Casino: recorded `casino:%` stakes and bet count, 30d. Payouts are not persisted
  by the current credit function, so wins/losses/profit cannot be recovered.
- Most held items: current `pvp_inv` quantities. Not item-use frequency.
- Historical peak concurrency, retention and player level have no reliable
  existing source; the portal explicitly says they are unavailable.
- Positions/device/session start are client-reported; gold is server-saved.
  Positions arrive through the existing roughly 12-second presence heartbeat;
  the 5-second viewer poll does not increase that source rate. Sessions expire
  after 45 seconds without a heartbeat.

## QA performed

- 33 focused owner/menu/map/mobile/keybind tests passed.
- Local DOM smoke: owner open, old-server pending state, escaped hostile player
  name, roster search, chart invocation, close and timer cleanup passed.
- The aggregate SELECT was run READ ONLY against the actual production schema
  to validate every referenced existing source column. No migration/deploy,
  production inserts, or production updates were performed.
- `gen_preload.mjs --check` is already stale on the base main; this change adds
  no static graph dependencies and intentionally keeps the portal lazy.
- Browser screenshots / actual in-game PC/phone visual checks remain to do.
