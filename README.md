# PUMPFUN PIRATES · Storm Hunt

### ▶ [Play now: banksydegen.github.io/pumpfun-pirates-game](https://banksydegen.github.io/pumpfun-pirates-game/)

On your phone, open the link and use **Add to Home Screen** to install it as an app.

A stormy, browser-based pirate game for **PUMPFUN PIRATES** ($AHOY).
You sail a PUMPFUN PIRATES ship flying the skull flag and hunt down rug ships that fly the cracked-pill flag.

> **Experimental fan game, for fun only.** Single player against AI ships (every player runs their own game).
> No real funds, no live rewards, not financial advice, no liability.

## Play locally

It's a static site with no build step. three.js 0.165.0 is loaded from jsDelivr through an import map.

```bash
cd pumpfun-pirates-game
python3 -m http.server 8080
# open http://localhost:8080
```

Opening `index.html` straight from disk (`file://`) won't work because ES modules need a server.

## Controls

| Action | Keyboard | Touch / mouse |
|---|---|---|
| Steer | `A`/`D` or `←`/`→` (hold) | ◀ ▶ in the bottom pill (hold) |
| Sails up / down (0–3) | `W`/`S` or `↑`/`↓` | ▲ ▼ |
| Drop / raise anchor | `Space` | ⚓ |
| Fire port (left) broadside | `Q` | **◀ FIRE** |
| Fire starboard (right) broadside | `E` | **FIRE ▶** |
| Orbit camera | drag | drag |
| Zoom | mouse wheel | pinch |
| Reset camera / sound / pause / fullscreen | `C` / `M` / `P` or `Esc` / `F` | top-right icons |

Broadsides auto-range on the nearest enemy on that side (within about 90 m and roughly abeam). Otherwise they fire at about 45 m. Each side reloads separately.

## Gameplay

- **Waves:** each wave sends more rug ships (and tougher hull types as you go), and every 4th wave adds a **DEV WALLET** boss. The first one (wave 4) is an easier intro fight; later ones hit harder. Your hull is fully repaired at the start of every wave, and clearing a wave gives a bonus.
- **Enemy AI:** enemies roam, close in once they spot you, circle to fire broadsides, and **flee** when their hull drops below 30%. A fleeing ship that goes 20 s without being hit slowly patches its hull (+10% every 4 s, up to half, then it comes back to fight; the treasure runner keeps running); bosses never repair. Some ships behave differently, so watch the health bars (a flashing bar means something is coming).
- **Hull self-repair:** go 20 s without taking damage and your hull repairs +5% every 4 s up to full (the HP bar pulses green). Any hit resets the 20 s; pause, shop and tutorial time don't count. **Hull Planks** speed it up: 17 s / +5.5% at level I up to 12 s / +7.5% at level VI (player only; enemy repair is unchanged).
- **Health crates:** each ship you sink has about a 1 in 3 chance to leave a floating medic crate (never more than 5 sinks in a row without one), and every boss always drops one (+25% hull, lasts 15 s, green on the radar).
- **Shipwright shop** (chest icon, `U`/`B`; pauses the game): spend gold on upgrades (hull, iron plating, sails, rudder, cannons, gun crew, spyglass) or a hull repair, and buy permanent **ship skins** on the SKINS tab (with live previews). A short how-to-play card opens at the start (turn it off with "Don't show again"; reopen from the shop `?` or the pause menu).
- **Scoring:** +5 per hit, +100 per sink (×3 for a boss) plus a wave bonus, plus gold from the floating treasure chests sunk ships drop (sail within about 10 m to grab one).
- **Game over:** your ship sinks, then you can enter a name and save to the leaderboard, or **SHARE** a 1200×675 score card (native share sheet on phones; on desktop a preview with download / copy image / post on X).
- **Pause menu:** master / SFX / music volume sliders and HOW TO PLAY.

## Wallet and leaderboard

- The title screen **requires a Solana wallet address** before you can sail. It must be base58, 32–44 characters, and decode to a 32-byte public key. The address is remembered in `localStorage`. A display name is optional.
- The leaderboard is **keyed by wallet** and keeps the best score per wallet. Wallets are shown shortened, like `39eB...ppump`.
- **Period tabs: DAY / WEEK / MONTH / YEAR / ALL-TIME** on the title and game-over boards. DAY/WEEK/MONTH/YEAR are *rolling* windows (last 24 h / 7 d / 30 d / 365 d). ALL-TIME reads the `leaderboard_best` view; the other tabs read recent rows from `scores` (`created_at >= since`, top 300 by score) and keep each wallet's best in the browser. No new SQL is required (an optional index is at the end of `schema.sql`). The local board stores timestamped runs (`pfp_runs_v1`) and filters them the same way. The last tab you picked is remembered.
- ⚠️ **Typed wallets are NOT verified.** Anyone can type anyone's address. Before any payout or reward you'd need a **Phantom `signMessage` signature check verified on a server** (see `js/rewards.js`).

### DAILY challenge (`js/daily.js`)

- **☀ DAILY** on the title screen starts a run on a fixed seed for the current **UTC day** (`YYYY-MM-DD`). Every pirate gets the same waves that day: enemy mix, spawn bearings and ranges, hull variants and chest scatter come from seeded streams (one per wave, so wave 5 is the same no matter how wave 4 went). Aim and reload stay random.
- **One run per wallet per day** (tracked on the device). After it, the button shows a countdown to 00:00 UTC; SAIL AGAIN after a daily is a normal run.
- Daily runs go to the **DAILY** board tab (best per wallet for today), never to the normal boards.
- Online it needs [`supabase/migrations/002_daily.sql`](supabase/migrations/002_daily.sql) (idempotent: adds nullable `mode` / `seed` columns, a policy that only accepts today's or yesterday's seed, and the `leaderboard_daily` view; normal inserts are unchanged and the rate limit trigger still applies). **Until it's run**, daily runs are saved on this device and the tab says "daily board coming soon"; normal boards keep working either way.

### Leaderboard modes (`js/leaderboard.js`)

- **Local (default):** `localStorage`, this device only, works offline.
- **Supabase (online):** turns on automatically once `js/config.js` has both values filled in. Scores are always saved locally as well, and the game falls back to local if the network fails.

### Turning on the Supabase leaderboard

`js/config.js` already points at the project's Supabase URL and **publishable** key (`sb_publishable_...`). That key is designed to be public, and security comes from RLS. The client sends new-style `sb_` keys only as the `apikey` header (legacy JWT anon keys also go in `Authorization: Bearer`).

1. In Supabase, go to **SQL Editor**, paste [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates the `scores` table, RLS policies (anyone can insert or read, nobody can update or delete), the `leaderboard_best` view, and a per-wallet rate limit.
2. That's it. Until the table exists, the REST API returns 404, and the game quietly falls back to the on-device board (labelled "this device · online board offline").
3. **Never** put the `service_role` / secret key in this repo.
4. After changing any file, bump `VERSION` in `sw.js` so installed copies pick up the update.

To use a different project, replace `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `js/config.js`. Leaving them empty switches to local-only mode.

### Anti-cheat limits (be honest about these)

The whole game runs in the browser, so **any score can be faked**: someone can call the REST endpoint directly, edit JS in devtools, or use the `window.PFP` debug hooks. The SQL adds range checks, a crude sinks-per-second plausibility check, and a rate limit. Those stop casual junk, not a determined cheater. If the board ever matters (prizes), you'd need:
- server-side validation (a Supabase Edge Function that issues a signed run token at start and checks the elapsed time and score rate at submit),
- wallet ownership proof (Phantom signature),
- and ideally replay or input-log verification, or moderation.

## Wallet connect (coming soon)

The title screen has a disabled **"Wallet connect coming soon"** button. `js/rewards.js` contains only TODO stubs (Phantom connect, ownership proof, eligibility, claim). With `WALLET_VERIFY_ENABLED = false` (as shipped) there is no wallet connection and no signing; the optional view-only `signMessage` check is described under *Wallet verification* below. **There is no fund handling anywhere in this code.**

## PWA / phones

- Installable: `manifest.webmanifest` (fullscreen, landscape, `#161616` theme), icons in `assets/icons/` made from the real skull logo (192, 512, maskable 512, Apple touch 180, favicon).
- iOS: Safari → Share → **Add to Home Screen**. Android Chrome: **Install app**.
- `sw.js` caches the app shell and the pinned three.js CDN modules, so after one online visit it plays offline. Leaderboard API calls are never cached.
- **Graphics (stylized toon look):** cel-shaded materials with a 4-step ramp, dark outlines, hand-painted procedural textures (no texture downloads), stylized storm sea and sky.
- **High quality** (desktops): bloom (lanterns, cannon fire, loot, lightning), vignette, FXAA, soft shadows. The post-processing modules are only downloaded on high.
- Phones automatically get **low quality**: no post-processing or shadows, cheaper water foam, lower pixel ratio, smaller ocean mesh, less rain and fewer particles, no antialiasing. You can force it with `?quality=low` or `?quality=high`, or set `QUALITY` in `js/config.js`.

## Wallet verification (built, OFF)

Phantom connect + a Sign-In-With-Solana style **`signMessage` only**. The signed text is plain and human-readable (domain, wallet, a "view-only, cannot move funds" statement, URI, nonce, timestamp). The code never requests `signTransaction`, `signAllTransactions`, `signAndSendTransaction` or any transfer/approval, and never sees keys or seed phrases.

- `js/config.js` → `WALLET_VERIFY_ENABLED = false` (shipped). Off means **nothing** wallet-connect related is shown or downloaded (`js/walletVerify.js` is only `import()`ed when the flag is on, and it's not in the service-worker precache). Typed wallets work exactly as before.
- On: the title button becomes **👻 CONNECT PHANTOM** (desktop with the extension), **OPEN IN PHANTOM** (phone browser: deep link `https://phantom.app/ul/browse/<this page>` opens the game inside Phantom's in-app browser) or **GET PHANTOM**. Connecting fills the wallet field and asks for one signature; the proof lives in `sessionStorage` for up to 24 h. Score saves then go to the `verify-score` Edge Function, which checks the ed25519 signature and inserts the row with `verified = true`. If that call fails, the score is saved the normal (unverified) way.
- Server pieces (committed, **not deployed / not run**): [`supabase/migrations/003_verified.sql`](supabase/migrations/003_verified.sql) (adds `verified boolean default false` + a restrictive policy so browsers can never insert `verified = true`) and [`supabase/functions/verify-score/index.ts`](supabase/functions/verify-score/index.ts) (tweetnacl + bs58; checks domain, wallet, the exact statement, URI, nonce format, issued-at within 24 h, then inserts with the service role; daily seeds limited to today/yesterday UTC like 002).

**To turn it on later:**
1. Supabase → SQL Editor → run `supabase/migrations/003_verified.sql` (run `002_daily.sql` first if you want verified DAILY runs).
2. Deploy the function: `supabase functions deploy verify-score --no-verify-jwt` (from the repo root, logged in with `supabase login` and linked with `supabase link --project-ref <ref>`). `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions automatically; optionally set `ALLOWED_ORIGINS` (comma-separated, default `https://banksydegen.github.io`) with `supabase secrets set ALLOWED_ORIGINS=...` if the game moves to another domain.
3. In `js/config.js` set `WALLET_VERIFY_ENABLED = true` (`VERIFY_SCORE_URL` defaults to `<SUPABASE_URL>/functions/v1/verify-score`), bump `VERSION` in `sw.js`, push.
4. Test with Phantom on desktop and inside the Phantom app on a phone. To switch it off again, set the flag back to `false`.

A signature proves wallet ownership, not that the score is legit (see anti-cheat limits above).

## Files

```
index.html             UI overlays + import map
css/style.css          HUD / menus (Just Another Hand font, brand colors)
js/main.js             game loop, player, enemy AI, cannons, waves, HUD, menus
js/ocean.js            wave field (shared CPU/GPU), stylized toon sea (foam lines, hull foam), storm sky, lightning bolt, GPU rain
js/ships.js            stylized ships built in code (plank hulls, railings, cannons, cabins, lanterns, rippling sails), flags
js/toon.js             toon ramp/materials, inverted-hull outlines, procedural painted textures (wood, cloth, metal, gold, rock)
js/props.js            treasure chests with light beams, horizon sea stacks + lighthouse
js/fx.js               pooled particles + chunky toon puffs/explosions + splash rings
js/audio.js            synthesized SFX + shanty loop (no audio files); js/soundProfile.js: per-upgrade sound settings
js/upgrades.js         Shipwright upgrade data; js/shop.js + css/shop.css: shop / skins UI
js/skins.js            ship skins; js/skinPreview.js: skin preview renders
js/upgradeVisuals.js   upgrades shown on the ship
js/enemyTypes.js       enemy hull types, wave roster, extra enemy behaviours, boss attacks
js/healthDrops.js      medic crates (~33% per sink, pity after 5, bosses always)
js/tutorial.js         how-to-play card
js/shareCard.js        game-over score card + share
js/tokenChip.js        $AHOY contract chip (copy) + DexScreener / X / Telegram links
js/leaderboard.js      Local + Supabase adapters
js/wallet.js           Solana address validation / shortening
js/rewards.js          non-functional rewards placeholder (TODO hooks)
js/config.js           Supabase URL + publishable key, quality, $AHOY CA + links, WALLET_VERIFY_ENABLED
supabase/schema.sql    table, RLS policies, best-per-wallet view, rate limit
supabase/migrations/   002_daily.sql (DAILY board), 003_verified.sql (verified flag)
js/daily.js            DAILY seed (UTC day) + seeded RNG
js/walletVerify.js     Phantom connect + signMessage (view-only), loaded only when WALLET_VERIFY_ENABLED
supabase/functions/    verify-score Edge Function (not deployed)
sw.js, manifest.webmanifest, assets/icons/   PWA
assets/                font, skull logo, wordmark, NFT captain portraits
```

## Brand notes

- The name is always **PUMPFUN PIRATES** (PUMPFUN is one word).
- Font: Just Another Hand. Colors: red `#fa0d0d`, gold `#ffcd77`, dark `#161616`.
- The player flag and sails use the real skull logo image. The enemy flag is an original cracked green/white pill parody, **not** the pump.fun logo.
- **Upgrade levels:** every shop upgrade has 6 levels (CANNONS 8) with smaller steps; maxing everything costs 5,275g. Each level adds visible parts to your ship.
- **Late waves:** past wave 8 each wave adds one ship (up to 15) and enemies get +7% HP and +4.5% damage per wave past 8 (DAILY too).
