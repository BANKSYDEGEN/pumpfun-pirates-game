# PUMPFUN PIRATES · security fixes (branch `post/security-fixes`)

Base: rebased onto origin/main `b131b7a` (2026-11-02 18:45 EST; includes the v112–v113 hotfixes: crew clothes, ships, settings move, title token pick). The SW VERSION is `pfp-v114`. Main bumps it often, so **at merge time set it to main + 1**.
**Nothing here is pushed, merged, deployed or applied.** Migrations 028–030 are files only. No leaderboard row, score or player
record is changed by any of them. They are additive: new columns with defaults, new tables, new or wrapped functions, and changed
privileges. Nothing is dropped, wiped or reset.

Status: **fixed** = closed once deployed · **partial** = narrowed, a gap remains (stated) · **not done** = needs a human.

## Per finding

### H1 · anyone could write any Waves score (anon INSERT on `scores`) — fixed (after migration 030)
- New pvp action `waves_score`. The run must have been noted by `waves_start` for the same pirate and must not already have a
  row (`pvp_waves_runs.scored_at`, set atomically). The score is checked against the **server-timed** run length with the same
  `wavesProblem()` the gold payout uses. If the run was already paid, the score can't exceed the paid score. Daily seed must be today or yesterday (UTC). The
  row is inserted with the service role; `verified` = the signed-in wallet equals the row wallet.
- `waves_start` throttle 10 s → 3 s so a quick restart still gets a server run.
- Client (`js/leaderboard.js`): tries `waves_score` first. 409 = already saved (ok). 400/404 (old server / no run) = the previous
  direct insert. That fallback only works until 030 is applied.
- Migration `030_scores_server_only.sql` drops the anon/authenticated insert policies and revokes insert/update/delete/truncate on
  `scores`. Reads unchanged. **Apply it last** (deploy step 5).
- **Back-compat / could reject legit scores:**
  - a run whose `waves_start` never reached the server (offline at start, 429 from a restart < 3 s) is not on the board after 030.
    It is still saved on the device, with the same "saved locally" path as before when Supabase is down.
  - Old cached clients (before SW v114) insert directly. After 030 their insert fails (saved locally) until they reload.
    Wait for adoption before 030.
  - Rollback: the commented block at the end of 030 re-creates the 003 policy and grants. Scores are never touched.

### H2 · kill board farmable (self-kills, alts, no seat proof) — fixed for Supabase Realtime, partial for the relay
- New pvp action `ticket` (before every arena / harbor / party channel join). It proves the secret lobby seat (seat id starts with the
  net id), binds the net id to the caller and notes the seat in `pvp_match_seats` (room, net, player, ip hash).
- `pvp_claim_kill` (028, same signature) counts a kill only if:
  - the killer and the victim were both seated in that match;
  - it is not a test room;
  - they are not on the same network (shared ip hash within 1 day);
  - they are not linked (pvp_links / pvp_alias);
  - they are not both brand new (< 24 h).
  - Caps: 40 kills per pair per day, 30 a day on brand-new victims. The existing 20 s / 6 per min / 600 per day rules are kept.
- Reward-linked exports use **signed** wallets only (H4 + `tools/export_airdrop.py`).
- Numbers: the live board had 31 kills all-time (top pirate 27, 0 today) when this was written. 40 per pair a day is far above
  any real pair.
- **Could reject legit kills:**
  - two real players behind one mobile CGNAT / campus NAT look like "same network", and their kills on each other don't count.
    Kills on everyone else still count.
  - Clients older than this release never ask for a ticket, so their kills stop counting until they reload. Nothing already on
    the board changes.
  - Rollback: the 028 rollback block restores the 017 `pvp_claim_kill` (re-run 017) and un-wraps the lobby. Tables can stay.
- Partial: on the (undeployed) relay the lobby is the relay's own, so match seats aren't written there.

### H3 · gold / shop farmable — partial
- `CAPS.valuePerMin` 10000 → 3000 and `bossPerMin` 1 → 0.5. `SEED_GOLD_CAP` 25000 → 5000.
  - Reasoning (in lib.ts): a mid player is ~620 gold/min with every multiplier; the best sustained pace seen is ~1,900/min.
  - A big one-off pile is delayed a few syncs, never lost (stepToward + retry).
- Shop kill goals use confirmed board kills only (`bd.kills`), not the client save.
- Waves gold was already server-paid per run.
- **Partial:** BR gold is still client-reported (paced by the caps). A server-authoritative economy needs a game server.
- **Back-compat:** a device with > 5,000 gold that never synced gets the rest released at the normal pace, not lost. Rollback:
  restore the three numbers in lib.ts and redeploy pvp.

### H4 · wallet sign-in phishable / airdrop wallet hijack — fixed
- Sign-In-With-Solana message (domain, URI, nonce, issued at, expires at, statement). Nonces are only issued to `ALLOWED_ORIGINS`,
  and verify checks the stored message names the verifying page. Nonces are purpose-bound (`signin` vs `airdrop`) and tied to the
  player.
- The plain-text message fallback is removed (pvp and pirate). A wallet that refuses SIWS gets a clear error.
- Airdrop wallet:
  - the first set is free;
  - **changing** it returns 428 unless it is signed by the **new** wallet (`airdrop_nonce`, then `airdrop` with signature). The
    client does this with one Phantom signature (text: "Changing it later: a free signature").
  - `pvp_airdrop.verified` is set when the change is signed or the wallet equals the signed-in wallet.
  - `tools/export_airdrop.py` exports signed wallets only by default. `--all` adds a `signed` column.
- **Back-compat:** existing unsigned airdrop rows stay (verified = false). The owner decides whether to ask those players to sign
  before a payout.

### H5 · XSS via peer ids / names — fixed (commit 0f5d531)
- Ids are whitelisted `^[a-z0-9]{6,20}$` on receive. Every innerHTML sink escapes. Null-prototype peer merge.
- Unit tests include an XSS payload.

### M1 · public Realtime channels (spoofing, eavesdropping) — partial until the dashboard toggle
- `ticket` returns a 30-min HS256 JWT (`PFP_RT_JWT_SECRET`) for ONE topic. The client joins `private:true` with it and refreshes it
  every 20 min. If the server refuses the private join, the client falls back to the public join.
- Migration 029 adds RLS on `realtime.messages`: an authenticated user can read/write only where `topic = jwt.pfp_topic`.
- Done after the human turns OFF "Allow public access" in Realtime settings (step 6).
- **Partial:** a ticket holder inside their own channel can still put another `i` in a message. H5 validation and the server-side
  kill checks limit what that can do.
- Relay: `server/relay.js` checks a `RELAY_TICKET_SECRET` ticket, an origin allowlist and per-IP caps. Prepared, not deployed.

### M2 · lobby / harbor RPC spam — fixed
- `pvp_lobby` / `pvp_harbor` are wrapped (originals renamed `*_core`, unchanged) with `pvp_rl_hit` limits:
  - 600 calls per min per IP;
  - 60 per min per seat (a client polls every few seconds);
  - 30 new seats per 10 min per IP.
- `ticket` is limited to 30 per min per pirate.
- **Could block legit play:** a large shared NAT (LAN party, school) with > 30 fresh joins in 10 min. It degrades to the
  "LOBBY OFFLINE, try again" banner, not a lockout. Raise `p_max` in the wrapper if it is ever seen.

### M3 · password login hardening — fixed
- The owner account can't log in by password at all (escape hatch: secret `OWNER_PASSWORD_LOGIN=1`), and `acct_set` is refused for it.
- Login throttles use a trusted client IP: `TRUSTED_IP_HEADER`, else cf-connecting-ip / x-real-ip / the **last** X-Forwarded-For hop.
- New passwords need 10+ characters. Existing 8–9 character passwords still log in.

### M4 · CDN supply chain / no CSP — fixed
- three.js r165 is self-hosted in `vendor/three-0.165.0` (byte-identical to jsDelivr, sha256s in SOURCE.txt).
- CSP meta on index.html / island.html. The inline failsafe moved to `js/boot.js`. `tools/csp_hash.py --write` re-pins the one
  inline hash.
- `'unsafe-eval'` is needed by three's Basis/KTX2 transcoder (embind) in a blob worker. Inline script stays blocked.
- The service worker (v114) caches same-origin only and no longer caches the CDN forever.
- Header CSP / HSTS can't be set on GitHub Pages; that needs a proxy (e.g. Cloudflare) if wanted.

### M5 · `?relay=` on prod — fixed
- On prod hosts `?relay=` is ignored unless the host is in `RELAY_HOSTS` (empty now). Dev hosts unchanged.

### M6 · mail domain spoofing (no DMARC, soft SPF) — not done (DNS, human)
See "Human actions".

### Lows — fixed
- Debug hooks and test URL switches are DEV-only (`js/env.js`). Prod `window.PFP` is a frozen read-mostly facade.
- `server/`, `supabase/`, `tests/`, `docs/`, internal notes and build scripts are no longer served by Pages (Jekyll `exclude`).
- Kept public on purpose: tools/*.html viewers, dev/pirate-items.html, audio-dev/preview (used for team review).
- Frame-busting on prod hosts (`js/framebust.js`; allows *.pumpfunpirates.com parents). Portal builds (itch/Newgrounds/CrazyGames)
  are not prod hosts, so they still frame.
- Null-prototype merges. supabase-js pinned to 2.118.0 in all functions.
- `verify-score` is not deployed. **Do not deploy it as-is**: it inserts scores without the run checks.

## Deploy order (client and server are coupled; follow the order)
1. **Migrations 028, then 029** (SQL editor or `supabase db push`, staging first). Safe with the current live client:
   - old clients keep working (public channels, direct score insert);
   - only new kill rules apply, and old clients' kills stop counting until step 3.
2. **Functions** `pvp` and `pirate` (`supabase functions deploy pvp pirate`). Set the secrets:
   - `PFP_RT_JWT_SECRET` = the project's (legacy HS256) JWT secret (Settings → API / JWT Keys), so Realtime accepts the tickets.
     If the project has moved to asymmetric signing keys only, Realtime won't accept HS256 tickets. In that case keep the legacy
     secret active, or leave this unset (public joins, M1 stays open). Without it tickets have no jwt and the client joins publicly;
   - optional: `TRUSTED_IP_HEADER`, `RELAY_TICKET_SECRET`;
   - check `ALLOWED_ORIGINS` includes every live origin.
   Note: the new SIWS sign-in needs the new client and server together. An old cached client asking for a nonce still works,
   because the server builds the message and the client just signs it.
3. **Client** (merge to main → Pages). SW v114 replaces old caches.
4. Wait ~1–2 weeks (or until the old-client share is negligible) for SW v114 adoption.
5. **Migration 030** (anon INSERT on scores revoked).
6. Test on staging: private channels with a ticket, then Realtime → "Allow public access" **OFF**.
7. Relay (optional, later):
   - deploy with `RELAY_TICKET_SECRET`, `ORIGINS`, `TRUST_PROXY`;
   - add the host to `RELAY_HOSTS` / `RELAY_DEFAULT` in js/config.js and to CSP `connect-src`.

## Rollback (per step)
- 030: run its commented rollback block (re-grants anon insert + the 003 policy). Do this first if scores stop arriving.
- Realtime toggle: turn "Allow public access" back ON. Clients fall back to public joins automatically.
- Client: revert the merge on main. The SW will update to the previous version on the next visit; bump VERSION if needed.
- Functions: redeploy the previous `pvp` / `pirate` from 726e9ed. The new columns and tables are harmless to the old code.
- 029: run its rollback block (drops the two policies).
- 028:
  - run its rollback block (drops the lobby/harbor wrappers and renames `*_core` back);
  - then re-run `017_banksy_owner_merge.sql` to restore the old `pvp_claim_kill`;
  - new tables and columns can stay.
  - Verified on a local PGlite replay: rollback 030 → 029 → 028 + 017 leaves anon lobby and anon score insert working.
- No step deletes data, so every rollback is lossless.

## Human actions
- **DNS (M6)**, at the pumpfunpirates.com DNS host:
  - `_dmarc` TXT: `v=DMARC1; p=quarantine; rua=mailto:dmarc@pumpfunpirates.com; adkim=s; aspf=s`. After 2–4 clean report weeks,
    change it to `p=reject`.
  - Root TXT SPF: `v=spf1 include:spf.privateemail.com -all`. Keep exactly one SPF record, and add any other sender you use.
  - DKIM: turn it on in the Namecheap Private Email panel and publish the record it gives.
- GitHub Pages → Settings → **Enforce HTTPS** on.
- Supabase secrets: `PFP_RT_JWT_SECRET` (required for M1), `TRUSTED_IP_HEADER` (optional), `RELAY_TICKET_SECRET` (relay only).
  `OWNER_PASSWORD_LOGIN` is left unset.
- Verify on staging which client-IP header Supabase Edge passes through, and set `TRUSTED_IP_HEADER` to it.
- The Realtime "Allow public access" toggle (step 6).
- Owner: sign in with the wallet. Password login for the owner account is intentionally off.
- Optional: delete the local working copy `/workspace/airdrop_wallets.csv` on the dev box when no longer needed.

## Tests run (dev box, nothing live)
- `node --test tests/config.test.mjs tests/relay.test.mjs tests/safe.test.mjs`: config/relay allowlist, escaping with XSS payloads,
  relay tickets.
- `deno check` on pvp/pirate/verify-score; `deno test supabase/functions/pvp/security_test.ts` (SIWS, JWT, tickets, trusted IP).
- PGlite: schema.sql + migrations 002–030 replay; behaviour tests for 028–030 (seats, same network, links, new pairs, pair
  cap, rate limits, private-channel RLS, anon insert revoked); rollback of 030 → 029 → 028.
- Headless Chrome (all Supabase calls and the Realtime socket mocked locally), on both index.html and island.html:
  - CSP check: no violations;
  - smoke: title screen, a Waves game saved through `waves_score` with the server run id (no direct insert), two pirates
    in the PvP arena seeing each other, emote, spectator joins, injected XSS states dropped, no console errors.

## Not security, found while testing
- Portal builds (itch / Newgrounds / CrazyGames) crashed at load on origin/main (`$('btn-wallet')` is removed by the crypto-free
  build before main.js touches it). This branch null-guards it (commit "fix portal builds"). It could also be cherry-picked to main
  on its own.
