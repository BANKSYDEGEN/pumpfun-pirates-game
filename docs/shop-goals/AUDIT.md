# PUMPFUN PIRATES · shop goals: tracking audit, what was added, trust notes

Base: `emerly/run-shop` 1625088 ("wip v103 profile card", on top of fb86696 "wip v103 final": her live shop client 68fb3ae, the ships v2 fixes, v103 prices + harbor plaza
shops, Waves gold migrations 023 / 024, hence this draft is 025), on main v102 2d5b6ec.
Nothing here edits `lib.ts` or `pvpSave.js`.

## 1. What is tracked today

| Stat | Client (js/pvp.js) | Server (pvp function) |
|---|---|---|
| Harbor boss kills (`bossKills`) | `onBotSunk`: +1 when *you* sink the harbor boss (local AI sim) | Wallet: `pvp_profiles.boss_kills` (020), never down (`keepCounters`), pace cap `bossBase 2 + 1/min` (`saveProblem`). Device: `pvp_dev_profiles.boss_kills` (022) via `dev_sync`, same caps (`stepToward`); the first sync caps it at 10 unless the id was known before the shop |
| BR kills, total (`kills`) | `creditKill`: +1 per non-idle player sinking, in **both** Solo and Squads arenas (not mode-gated) | Profile `kills` (pace cap `2 + 8/min`) **and** the confirmed board `pvp_kills` (both sides claim; 20 s repeat guard, 6/min, 600/day). Goals use `max(profile, board)` (`shopView`, `shop_buy`) |
| BR kills by mode | **not tracked** | **not split**, but `pvp_kills.room` holds the arena room: Solo `pfp-pvp-v1-<n>`, Squads `pfp-pvp-v1sq-<n>` |
| Deaths (`deaths`) | +1 per non-idle player death in the arena (Solo + Squads; AI / harbor deaths never count) | Profile `deaths` (never down) and board deaths; goals use `max(profile, board)` |
| K/D | `kills / max(1, deaths)` | same (`lib.ts statOf`) |

## 2. What was missing, per goal

- **COMMODORE (100 harbor boss kills):** nothing in tracking. Missing: progress in the shop UI. The v98 free grant stays
  (`pvpSave.js` / `pvpSkins.js` untouched; 022 backfills `legacy_commodore`).
- **DIAMOND (5,000 BR kills, Solo + Squads):** the total is tracked and already counts both modes. Missing: the Solo / Squads
  split for the card, and progress in the UI.
- **FIRE / FLAMING (K/D >= 10 and 50+ kills):** nothing in tracking. Missing: progress in the UI.
- **All:** the server answered `stats` only; the client had to recompute the goal. Missing: the server's own per-goal verdict.

## 3. What this branch adds (all additive)

- `supabase/functions/pvp/goals.ts` (new, read-only): `goalsView(stats)` (per goal item: met + rows have/need, from
  `SHOP_ITEMS`, the same stats `shop_buy` checks; checked equal to `goalMet` on test cases) and `killsByMode()` (calls the
  025 function; returns null if it isn't there yet).
- `index.ts`: `shopView` (shop_state / dev_sync answers) also returns `goals` + `modes`; `shop_buy`'s 403 "goal not reached"
  also returns that item's `goal` progress + `stats`. Nothing else changes; no write paths touched.
- `docs/shop-goals/025_shop_goals.DRAFT.sql` (NOT RUN, kept out of `supabase/migrations`): one read-only function
  `pvp_kills_by_mode(p_player)` (Solo / Squads kills + deaths from the confirmed board by room name, alias-resolved like
  `pvp_kills_me`). No new tables or columns, no data touched.
- `js/modeKills.js` (new) + one line in `creditKill`: a this-device Solo / Squads kill counter (`pfp_br_mode_kills_v1`),
  display only, never sent, never read by gameplay or saves. The server split wins when it answers.
- `js/shopGoals.js` (new): goal stats (server shop view > device save + board `me` > none), shared rendering for shop cards,
  the detail pane and the profile. PROFILE: Emerly's v103 panel (js/uiProfile.js, 1625088) fires `pfp-profile`; a SHOP GOALS
  section (Battle Royale only, `pf-br`) mounts above ACCOUNT with each goal item, its bars, and `BUY · <price> at the SHOP`
  once met. Not on the portal builds.
- Prices: v103 ladder (blood 5,000 … diamond 250,000) as in Emerly's catalog + lib.ts; goals unchanged.
- On Emerly's `js/shopCatalog.js` / `js/islandShop.js` / `css/islandShop.css`: goal labels (`Harbor boss kills`, `FIRE` tag,
  DIAMOND `modes`), `goalProgress` with a no-stats mode + `liveGoal()` / `fmtGoal()`; locked cards show each goal row as
  text + bar; a met goal turns the card to `BUY · <price>` (or `✓ GOAL MET · need Xg`); the detail pane uses the same rows
  plus the Solo / Squads line on DIAMOND; re-draws when a server view lands. Her COMING SOON gear and real provider unchanged.
  `goalProgress` stays compatible with her pvp.js calls (goal toast, BR menu).
- `window.PFP_ISLAND_SHOP` added next to her `window.PFP_SHOP`: js/shop.js (the upgrade shop) also sets `window.PFP_SHOP`,
  so whichever module loads last wins that name. Worth renaming on her side.
- `sw.js`: `js/shopGoals.js` + `js/modeKills.js` in the shell. VERSION not bumped (the release bumps it).

## 4. Trust notes

- Nothing added here writes anything or feeds a purchase decision: `goals` / `modes` are read-only views. **No new trust.**
- `shop_buy` (Emerly's) decides on `max(profile stats, board)`. So each goal is only as strong as the weaker source:
  - **COMMODORE:** client-reported only (the harbor boss is simulated on the client; no peer or server confirmation).
    Guarded by pace caps (2 + 1/min online; first device sync capped at 10) and never-down. Same as the v98 unlock.
    A modified client could reach 100 in roughly 100 online minutes.
  - **DIAMOND:** effectively profile `kills` (client-reported, capped 2 + 8/min), not the confirmed board.
  - **FIRE:** kills as above; deaths are `max(profile, board)`. A board death needs the victim's own claim, so a client
    that never reports its deaths keeps both profile and board deaths low. K/D is the weakest goal.
  - The Solo / Squads split (025) is the confirmed board only (both sides claimed), so it is **not** client-trustable; the
    this-device counter is display only.
- Options if BANKSY wants them stricter (NOT built, they change enforcement): DIAMOND / FIRE on board-confirmed kills only;
  FIRE deaths also counting unmatched killer claims against you (`pvp_kill_claims` side 'k' never confirmed by the victim).

## 5. For Emerly's client (pvpSave.js, hers)

- `takeShop()`: forward `goals: j.goals, modes: j.modes` in the `pfp-shop-sync` detail, or add `modes` to `shopCache()` and
  her provider's state (`modes: st.modes`). Until then DIAMOND's Solo / Squads line falls back to this device's counter,
  marked "(this device)". The goal itself is unaffected.
- Optional: put `shopState` on `window.PFP_PVP_SAVE` so `refreshGoalStats()` (profile) can pull a fresh server view.

## 6. Screens

`/workspace/timothy-ui/screens/goals/` (`docs/shop-goals/goal_shots.py`, `profile_hook_shot.py`; port 18953; all faked locally).
