# PvP arena build: progress (WIP branch `pvp-wip`, NOT pushed)

## Flow (harbor → queue → arena)
- PVP button → entry card (name, optional read-only wallet link, SET SAIL) → **HARBOR**: a local sea with AI ships (no network,
  invisible to the arena). **JOIN BATTLE** → the lobby gives a free slot (spawn at the farthest spawn point, with protection) or a
  **queue place** (shown in the harbor bar). Staying in the harbor without queuing is fine. SPECTATE is reachable from the harbor.
- A freed slot is **offered** to the queue head: "BATTLE READY! Set sail?" with a 15 s countdown (PVP_OFFER). Missed / NOT NOW once
  = keeps the place (the slot goes to the next pirate); missed twice = back of the line.
- **Rotation:** dying while the queue is non-empty sends you to the BACK of the queue (death screen: "Sent to the queue, position #N"),
  and the slot is offered to the head. Empty queue = normal respawn after PVP_RESPAWN (4 s). Drop / K/D / saves unchanged.
- **AFK:** no input for PVP_AFK.kick = 180 s in the arena (warning "MOVE OR BE SENT TO THE HARBOR" for the last 30 s) = back to the
  harbor, ALWAYS (queue or not). Not a death unless you took PvP damage in the last 10 s (combat-log rule). Carried gold stays.
  Anti-farm: a pirate sunk after ≥ 60 s idle (PVP_AFK.farm) drops no +100 bonus and gives no kill credit / no death / no bounty.
- **AI ships:** HARBOR ONLY, local, never networked. The arena is players only, always (also when you're alone in it; BANKSY
  2026-10-31). Harbor AI only ever target / aim at / fire on YOU: their balls never hurt other AI ships, AI never credits AI kills
  (t11: 60 s harbor run, AI HP only drops from your shots). AI kills never count for K/D or boards. The host only handles loot.
  [v92] Sunk IN THE HARBOR = lose min(100, your gold) (PVP_HARBOR_DEATH_LOSS), keep the rest (was free). Never K/D.
- Authority: the lobby is ONE place (Supabase: `pvp_lobby()` RPC with an advisory lock, migration 007 APPLIED; relay: server/relay.js).

## Netcode capacity (Supabase Realtime FREE: 100 msgs/s project-wide sent+delivered, 200 connections, presence 20/s)
- Before: each client sent states at 60/N² Hz (2-10 Hz) + separate shot/hit/event messages → a room cost ≈ N²·r + events·N.
  2 players at 10 Hz = 40/s, 3 at 6.7 Hz = 60/s: the whole project fit ~1 room. Measured (headless) 3 clients: 13.7 msgs/s at 1.3 Hz.
- Now (js/transport.js): everything a client says in a tick (ship state + any events) is ONE broadcast; state deltas (static fields
  only when changed / every 3 s), idle suppression to a 1.5 s keepalive, lone player 1 Hz. Arena cost = N·r·(N+S) msgs/s.
  r = 4 Hz + interpolation (dead reckoning). **MAX_ARENA = 4** (4·4·4 = 64/s); +1 spectator = 80/s = our 80 % budget.
  Presence: NOT used (0/s). Connections: ≤ 5 of 200. Queue/harbor: 0 Realtime msgs (lobby poll = 1 PostgREST call / 3 s).
  Measured: 2 players → 3.4-3.7 sent/s each, room total 11-14 msgs/s (model 16).
- **Supabase free numbers: 4 players per arena, 4 in arena project-wide (+1 spectator), queue up to 100 waiting in harbors.**
- **Relay server (server/, NOT deployed):** frames = N·r per room, no per-project cap. Default 16 players/room × ROOMS (12) at 10 Hz.
  Measured locally: 640 players (40×16) = 20 % of one core, 63 Mbps, ~12 KB/s per client, p99 113 ms. Bandwidth-bound:
  ~50 MB per player-hour. **Relay numbers: 16 per arena (configurable), hundreds concurrent per small VPS (CPU ~2000+/core).**
- Switch: `PVP_RELAY_URL` in js/config.js (or `?relay=ws://localhost:8080` for testing). All capacity numbers live in `PVP_NET`.

## Economy (js/config.js HARBOR_* / pvpTierCost; same price in harbor and arena; mirrored in supabase/functions/pvp/lib.ts)
- Harbor AI scale with your total upgrade level L (0-44): HP 70·s, gold 10·s (v92: ×2, HARBOR_PAY_MUL; upgrade prices still priced off 5·s) with s = 1 + 0.137·L; size +1 %/L (hitbox too), damage +2 %/L.
- PvP upgrade cost of tier index t = harborKills(t) × harborGold(L ≈ 7t), harborKills(t) = 40 + 10·1.55^t (cheap early, steep top).
- Hard cap per track: 6 levels (CANNONS 8). Maxed tracks show **MAX VI / MAX VIII** in the shop; more gold buys no power.

| tier | typical L | harbor AI gold | AI HP | cost | harbor kills needed |
|---|---|---|---|---|---|
| I | 0 | 10 (was 5) | 70 | **75** (was 250; BANKSY) | **8** (was 15) |
| II | 7 | 20 (was 10) | 137 | 540 | 27 (was 54) |
| III | 14 | 30 (was 15) | 204 | 930 | 31 (was 62) |
| IV | 21 | 38 (was 19) | 271 | 1,500 | 40 (was 79) |
| V | 28 | 48 (was 24) | 339 | 2,360 | 50 (was 99) |
| VI (cap, 6 tracks) | 35 | 58 (was 29) | 406 | 3,750 | 65 (was 130) |
| VII (CANNONS) | 42 | 68 (was 34) | 473 | 6,030 | 89 (was 178) |
| VIII (CANNONS cap) | 42 | 68 (was 34) | 473 | 8,610 | 127 (was 254) |
Maxing everything = 78,725 g (was 79,950 before the 75 g level 1). A player kill = victim's carried gold + 100 bonus (+ bounty) ≈ 10 early harbor kills, ≈ 1.5 late ones (v92 double harbor pay).

## Streak bounty (PVP_BOUNTY)
- +25 g per counted kill in a row, cap 500. Counted = a real player, not idle ≥ 60 s, not the same victim again within 120 s; never AI.
- Dropped in your death pile: carried + 100 + bounty. Resets on death or leaving the arena (rotation, AFK, quit).
- Shown as ☠amount on the name tag, the spectate board (☠ column) and the spectate HUD; feed announces ≥ 200 g bounties and claims.
- Network: rides in the normal state ('bt') and 'sunk' ('b') messages; the host caps a claimed bounty at what the victim showed.

## Holder perk (web build only, HOLDER_ENABLED = !ON_PORTAL)
- Linked wallet (read-only signMessage) holding ≥ HOLDER_MIN_TOKENS = 1 $SUNK or $AHOY: **HOLDER 2× GOLD** badge (HOLDER_GOLD_MUL 2, was 1.05, on
  earned gold: harbor AI gold and the +100 kill bonus; not carried gold / bounties) + **Claim daily gold** (HOLDER_DAILY_GOLD 100,
  once per wallet per America/Indianapolis day). Balance checked SERVER-SIDE in the `pvp` Edge Function (getTokenAccountsByOwner on a
  public Solana RPC, cached 10 min in `pvp_holders`; RPC error = no perk, re-checked after 1 min). Claim enforced by `pvp_holder_claim()`
  (unique wallet+day) and credited to the wallet's PvP save. Edge Function `pvp` redeployed with holder + holder_claim + the new cost curve. No transactions or approvals anywhere.
- Verified: Token-2022 balances for both mints read correctly; e2e with a throwaway keypair (non-holder 403; simulated holder: claim
  200, second claim 409); test rows deleted.

## Bug-hunt pass (live, 2026-10-31)
- **RETURN TO HARBOR** (⚓ HARBOR HUD button, desktop + phones, and in the 🏴 menu): keeps carried gold (saved to the PvP profile), not a
  death, frees the arena seat (next in queue gets the offer), lands in the harbor NOT queued, bounty resets. Anti-dodge: needs 10 s
  with no PvP damage dealt or taken (countdown otherwise), can't start below 30 % hull ("Too damaged to retreat"), any damage taken
  cancels it, firing restarts it, a killing hit on the finishing frame wins. Closing/reloading within 10 s of combat = a death.
- **Entry pop-up SOLANA WALLET** (optional, web only): same stored wallet + checks as the Waves game-over field, "Used for airdrops.
  Never asks for keys or signatures.", Enter moves name → wallet → SET SAIL. Stored privately via the pvp function in
  `pvp_airdrop` (migration 008: RLS on, no anon/auth grants, one change per 30 s per player, updated_at); never broadcast or shown.
  Export (read-only, no secrets printed): `python3 tools/export_airdrop.py [/workspace/airdrop_wallets.csv]` (needs
  SUPABASE_ACCESS_TOKEN in the env; merges Waves scores/players + PvP entry + PvP signed-in wallets, QA_ rows dropped).
- HUD name: the chosen PvP name now shows top-left (and in tags / feed / boards); no name typed = your saved name, else CAPT. #N.
  A random pirate name is no longer written into the Waves name slot.
- **Gold piles never despawn** (arena + harbor): live piles capped at PVP_PILE_CAP 30; past it the oldest pile's gold merges into its
  nearest pile ('gone' + 'pv'), so no gold is lost. Host resyncs the pile list every 10 s and on 'hello' (late joiners, spectators). t13.
- **Level 1 of every upgrade track = 75 g** (PVP_TIER1_COST, mirrored in the pvp function): 8 harbor kills at L0 (15 before the v92 double pay). Higher tiers unchanged.
- Title: BATTLE ROYALE (left) + WAVES (right), equal size, no (BETA); SPECTATE/WATCH BATTLE ROYALE; full $SUNK CA on its own line
  (monospace, shrinks to fit, never truncated) with the links under it, every layout. Portal builds: WAVES only, no token row.
- Raul's premium pass + Flaming redesign (pvpKit liftRig / signatureWake, Golden, Ghost, Kraken, Diamond, flamingRedesign.js).

## Waves (solo) skin looks + separation
- Raul's GOLDEN / GHOST parts and Timothy's tier looks for BLOOD (PvP "CRIMSON SAILS") and MIDNIGHT (PvP "BLACK PEARL") now dress
  the same skins in Waves (js/skinLooks.js; their tick hooks run on the Waves player ship). Diamond, Kraken, Flaming, Sea Green, Coral,
  Storm, Admiral are PvP-only skins (Waves doesn't sell them), so nothing to apply there.
- CLASSIC (and every other Waves skin) is pixel-identical to main (cmp_defaults: classic + navy 0 px diff); hitboxes identical to main for
  all four upgraded skins (t10); phone low quality: no extra draw-call / triangle cost of note (t10).
- Unlocks stay separate: Waves skins = bought in the Waves shop ('pfp_skins_v1' + the solo wallet copy, unchanged); Battle Royale
  skins = PvP lifetime kills only (pvpSave cleanProfile recomputes from kills). They never shared storage; t10 verifies both ways.
- Gold is fully separate: Waves gold resets every run (as before) and is never read into the PvP save; PvP gold (device / wallet PvP
  save) never shows in Waves. t10: Waves run ended with 777 → PvP still shows its own balance; PvP 4321 → Waves starts at 0 → PvP 4321.

## Done earlier
- Drop-in arena, client-authoritative ships, host loot, death drop carried + 100, spawn protection, quit-to-dodge, device + wallet
  saves, K/D, kill-tier skins (Raul diamond/golden/ghost/kraken/pvpKit/partsOverride/mobileSkins, Timothy flaming/tierLooks incl.
  504bbed/cc2776e; tierTick gets the ship id for Storm lightning), PvP KILLS board (ALL/MONTH/DAY, Indianapolis), home WAVES / BATTLE
  ROYALE switch, SPECTATE (receive-only), solid rocks (both modes), ULTRA graphics tier (opt-in desktop).

## Left
- 4K ULTRA screenshots: skipped (owner OK; swiftshader too slow at 3840×2160 here).
- Re-run t3/t4/t5/t6/cmp_defaults after the harbor change; delete QA_ rows (pvp_kills/pvp_players/pvp_net/pvp_kill_claims/pvp_seats).
- Final: sw pfp-v60, squash to main as BANKSYDEGEN, push, verify live. Relay hosting = owner's decision.

## Tests (/workspace/pfp-br-test)
- t8.py: full arena (cap 2) + queue + death rotation + offer accept + missed offer + no arena AI + msg rate. 16/16 on Supabase.
  `python3 t8.py ws://localhost:18794` runs it on the relay (15/16; the rate check is Supabase-specific).
- t10.py: Waves skin looks (screenshots waves_skin_*.png, hitbox parity with main, phone low cost), unlock + gold separation. 16/16.
- t11.py: harbor AI only fights you (60 s) + entry wallet (prefill, styling, Enter, private storage, anon can't read). 13/13.
- t12.py: RETURN TO HARBOR (quiet 10 s, HP ≥ 30 %, damage cancels, firing restarts, death wins, seat freed, unload = death, phone).
- t9.py: bounty, idle-victim rule, AFK warning + kick, harbor AI L0 stats, holder badge + 5 %. 12/12.
- server: `node server/loadtest.js 16 2 15 ws://localhost:18794 20`.

## Waves entry pop-up + Waves skins picker (pfp-v67)
- WAVES opens `#waves-entry` (same card style as the BATTLE ROYALE entry): pirate name, optional SOLANA WALLET (airdrops), save progress / connect wallet,
  and the Waves SKINS picker (same `.pvp-skin` cards as the PvP picker). The title page no longer has a save-progress section. Portal builds skip the pop-up.
- The shop's SKINS tab is gone in both modes; the shop is upgrades only.
- Waves unlock schedule (fixed, price order; skins you already own stay owned; Waves-only `pfp_skins_v1`, never PvP):
  CLASSIC free · 5 SAND GOLD PARCHMENT · 10 BLOOD SAILS · 15 MIDNIGHT BLACK · 20 ROYAL NAVY · 25 DEGEN GREEN CANDLE · 30 GHOST SHIP · 35 GOLDEN GALLEON ·
  40 SEA GREEN · 45 KRAKEN INK · 50 CORAL REEF · 55 STORM RIDER · 60 ADMIRAL WHITE · 65 FLAMING SHIP · 70 DIAMOND.
  Reaching wave N in a run unlocks every skin scheduled at or below N.
- Home screen (pfp-v67): no tagline / descriptive text on desktop or phones (desktop keeps the controls line). All legal text lives in the '?' pop-up only:
  token disclaimer "$SUNK and $AHOY are memecoins with no intrinsic value or expectation of financial return. Not financial advice. DYOR." +
  "© 2026 BANKSYDEGEN / PUMPFUN PIRATES. All rights reserved." (from LICENSE). Crypto-free portals: '?' = how to play + the copyright line, no token text.
  Phones: leaderboard shows 10 rows (8 on short phones, 7-8 in landscape); the title camera frames the ship lower.
- Controls (pfp-v67): ⌨ button on the title, in the in-game HUD (both modes) and on the pause screen opens CONTROLS. Desktop: every action
  has two rebindable slots (click, press a key; a key in use swaps over; Esc reserved; RESET TO DEFAULTS), saved in localStorage 'pfp_keys_v1'
  (js/keybinds.js, js/controlsUi.js). Phones: touch controls list. Every controls line on the page follows the current binds.

## pfp-v69 (BANKSY batch 2)
- **Rank on the player card**: Battle Royale shows `NAME · #N` = all-time PvP kills rank (same order as the ALL TIME board), `#—`
  unranked. `pvp` function action `me` + `pvp_kills_me()` (migration 009, read-only). Refreshes on entry, every 30 s and after each
  recorded kill. Waves keeps the captain/NFT number.
- **Lifetime K/D on the HUD**: KILLS / DEATHS / K/D = saved lifetime stats (device / wallet save, same as upgrades + skins), or the
  server's confirmed count if higher. Other captains see the same numbers (state 'K' / 'D'); the spectate board shows all-time
  K / D / K/D + a live hull bar per captain.
- **Kills board fix (migration 010)**: root cause: `pvp_claim_kill` dropped a both-sides-confirmed kill when the same killer had sunk
  the same victim within 2 minutes, so 1v1 arenas lost about half their kills (BANKSY2 board 6 K / 3 D vs ~4 K/D in game).
  Now 20 s (spawn-camp guard); 6/min + 600/day caps kept. One-off reconcile inserted the 6 confirmed-but-dropped kills from the used
  claim pairs (BANKSY2 → 12 K / 3 D). Nothing deleted. Boards refresh every 30 s while visible and right after a recorded kill.
- **HUD (phones)**: 🎨 SKINS + ⚓ HARBOR + 🏴 docked in a row under the minimap (js/pvp.js dockButtons), portrait ⌨ left of the map,
  4 icons in the top row, in-game logo hidden in portrait so name + rank fit, small landscape score bar 2×2. Root cause of the
  missing 🏴 in v67/v68: the ⌨ button moved 🧰 SHOP one slot left, exactly onto 🏴 (desktop / landscape); in portrait 🏴 sat on the map.
- **Spectate**: 👁 SHOW HUD button while the HUD is hidden (also H / double-tap). Free camera: WASD / arrows (desktop) or one-finger
  drag (phones) pan the focus, clamped to the arena; Q/E or ◀ ▶ captains, F follow, L leader, O overview; pinch / wheel zoom.
- **Mouse binds**: fire left alt = Mouse 4 (side), fire right alt = Mouse R; Mouse 5 / M bindable, left click reserved (orbit).
  Saved binds kept (defaults only fill empty slots). No context menu over the game, no back/forward from side buttons in game.
  'Shop (Waves)' → 'Shop' (U/B opens it in both modes). Wheel zoom = existing OrbitControls zoom (unchanged), now in the controls list.
