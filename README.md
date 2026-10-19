# PUMPFUN PIRATES · Storm Hunt

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

- **Waves:** each wave sends more rug ships, and every 4th wave adds a **DEV WALLET** boss. Clearing a wave repairs 25 hull and gives a bonus.
- **Enemy AI:** enemies roam, close in once they spot you, circle to fire broadsides, and **flee** when their hull drops below 30%.
- **Scoring:** +5 per hit, +100 per sink (×3 for a boss) plus a wave bonus, plus gold from the floating treasure chests sunk ships drop (sail within about 10 m to grab one).
- **Game over:** your ship sinks, then you can enter a name and save to the leaderboard.

## Wallet and leaderboard

- The title screen **requires a Solana wallet address** before you can sail. It must be base58, 32–44 characters, and decode to a 32-byte public key. The address is remembered in `localStorage`. A display name is optional.
- The leaderboard is **keyed by wallet** and keeps the best score per wallet. Wallets are shown shortened, like `39eB...ppump`.
- ⚠️ **Typed wallets are NOT verified.** Anyone can type anyone's address. Before any payout or reward you'd need a **Phantom `signMessage` signature check verified on a server** (see `js/rewards.js`).

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

## Crypto rewards (placeholder only)

The title screen has a disabled **"Connect Wallet · $AHOY rewards coming soon"** button. `js/rewards.js` contains only TODO stubs (Phantom connect, ownership proof, eligibility, claim). **There is no wallet connection, no signing, and no fund handling anywhere in this code.**

## PWA / phones

- Installable: `manifest.webmanifest` (fullscreen, landscape, `#161616` theme), icons in `assets/icons/` made from the real skull logo (192, 512, maskable 512, Apple touch 180, favicon).
- iOS: Safari → Share → **Add to Home Screen**. Android Chrome: **Install app**.
- `sw.js` caches the app shell and the pinned three.js CDN modules, so after one online visit it plays offline. Leaderboard API calls are never cached.
- Phones automatically get **low quality**: lower pixel ratio, smaller ocean mesh, less rain and fewer particles, no antialiasing. You can force it with `?quality=low` or `?quality=high`, or set `QUALITY` in `js/config.js`.

## Files

```
index.html             UI overlays + import map
css/style.css          HUD / menus (Just Another Hand font, brand colors)
js/main.js             game loop, player, enemy AI, cannons, waves, HUD, menus
js/ocean.js            wave field (shared CPU/GPU), ocean shader, stormy sky, GPU rain
js/ships.js            procedural low-poly ships, skull flag/sail textures, parody pill flag
js/fx.js               pooled particles (muzzle flash, splashes, hits, smoke, wake, sparkles)
js/audio.js            synthesized SFX (no audio files)
js/leaderboard.js      Local + Supabase adapters
js/wallet.js           Solana address validation / shortening
js/rewards.js          non-functional rewards placeholder (TODO hooks)
js/config.js           Supabase keys (placeholders) + quality setting
supabase/schema.sql    table, RLS policies, best-per-wallet view, rate limit
sw.js, manifest.webmanifest, assets/icons/   PWA
assets/                font, skull logo, wordmark, NFT captain portraits
```

## Brand notes

- The name is always **PUMPFUN PIRATES** (PUMPFUN is one word).
- Font: Just Another Hand. Colors: red `#fa0d0d`, gold `#ffcd77`, dark `#161616`.
- The player flag and sails use the real skull logo image. The enemy flag is an original cracked green/white pill parody, **not** the pump.fun logo.
