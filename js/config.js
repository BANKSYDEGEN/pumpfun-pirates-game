// ===================================================================
// PUMPFUN PIRATES · config
// Fill in BOTH Supabase values to switch the leaderboard from
// this-device-only (localStorage) to a shared online board.
// The anon key is public by design; security comes from the RLS
// policies in supabase/schema.sql. NEVER put the service_role key here.
// ===================================================================
// Game portals (itch.io html*.itch.zone, Newgrounds uploads.ungrounded.net, CrazyGames *.game-files.crazygames.com / *.crazygames.com): the game runs fully offline and crypto-free there:
// no Supabase requests at all (this-device scores only), no wallet sign-in, no token/social links (see js/portal.js).
export const ON_PORTAL = typeof location !== 'undefined' && /(^|\.)(itch\.zone|ungrounded\.net|crazygames\.com)$/.test(location.hostname);
export const SUPABASE_URL = ON_PORTAL ? '' : 'https://qhandcjwlkmovjzwzqfk.supabase.co';        // e.g. 'https://abcd1234.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_yKPJooRyGC0oSIOjKcmLtw_nB7TAD81';   // the project's "anon public" key

export const LEADERBOARD_TABLE = 'scores';          // insert target
export const LEADERBOARD_VIEW = 'leaderboard_best'; // best score per wallet
export const LEADERBOARD_DAILY_VIEW = 'leaderboard_daily'; // DAILY board (needs supabase/migrations/002_daily.sql)

// Graphics: 'auto' picks low on phones / weak GPUs. Also 'low' | 'high'.
// Override per visit with ?quality=low or ?quality=high
export const QUALITY = 'auto';

// $SUNK token chip on the title screen (tap copies the full CA) + socials
// $SUNK contract address and DexScreener chart link.
// Drop the real CA + DexScreener pair URL in here at launch: this is the ONLY place they live (used by js/tokenChip.js + js/shareCard.js).
export const SUNK_CA = 'By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump';
export const SUNK_DEX_URL = 'https://dexscreener.com/solana/By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump';
export const SUNK_CA_TEXT = SUNK_CA || 'TBA'; // what players see where the CA goes
export const X_URL = 'https://x.com/PUMPFUNPIRATES';
export const TG_URL = 'https://t.me/PUMPFUNPIRATES';

// Wallet verification (Phantom connect + signMessage, VIEW-ONLY: never a transaction). BUILT BUT OFF.
// false = nothing wallet-connect related is shown or even downloaded; typed wallets work as before.
// Turn on only after migration 003_verified.sql is run and the verify-score Edge Function is deployed
// (README "Wallet verification").
export const WALLET_VERIFY_ENABLED = false;
export const VERIFY_SCORE_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/verify-score` : '';

// Read-only wallet sign-in + server-saved progress (Edge Function `pirate`, migration 004_players.sql).
// The wallet only signs a plain-text message: never a transaction. Guests (SET SAIL) keep saving on this device.
export const WALLET_SAVE_ENABLED = !ON_PORTAL; // off on game portals
export const PIRATE_FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/pirate` : '';

// ---------------- PvP ARENA (BETA): drop-in, real-time, Supabase Realtime broadcast (no extra hosting) ----------------
// Off on game portals (no Supabase there). Upgrades/prices/stats come from js/upgrades.js, same as solo.
export const PVP_ENABLED = !ON_PORTAL && !!SUPABASE_URL;
export const PVP_DEATH_BONUS = 100;   // a sunk pirate drops ALL carried gold + this flat bonus (carrying 0 drops 100; 1000 drops 1100)
export const PVP_AI_GOLD = 5;         // fallback gold pile of a LOCAL AI ship (harbor, or a lone player in the arena); real value = harborGold(L) below. AI kills never count for K/D / boards
export const PVP_PILE_LIFE = Infinity; // PvP gold piles never despawn (BANKSY): they float until someone collects them
export const PVP_PILE_CAP = 30;       // live piles per arena (and in your harbor); past it the OLDEST pile's gold merges into its nearest pile
export const PVP_PILE_MAX = 100000;   // value clamp for a (merged) pile
export const PVP_RESPAWN = 4;         // seconds before you sail again after sinking (upgrades kept, gold back to 0)
export const PVP_PROTECT = 3;         // spawn protection seconds (ends early the moment you fire)
// ---- PvP NETWORK CAPACITY: the ONE place to change it (the server side must match: supabase/migrations/007_pvp_lobby.sql, server/relay.js env) ----
// Supabase Realtime FREE: 100 msgs/s project-wide (sent + delivered), 200 connections, 20 presence msgs/s (we use none).
// Clients batch everything into one message per tick, so an arena of N players at r Hz with S spectators costs N·r·(N+S)/s.
// 4 players @ 4 Hz = 64/s (+1 spectator = 80/s, our 80% budget). Everyone else waits in the local harbor queue (0 msgs).
export const PVP_RELAY_URL = ((u) => /^(wss:\/\/[a-z0-9.-]+|ws:\/\/localhost)(:\d+)?(\/[\w/-]*)?$/i.test(u) ? u : '')(new URLSearchParams(location.search).get('relay') || ''); // 'wss://…' once a relay server is hosted ('' = Supabase fallback); ?relay= for testing
export const PVP_NET = {
  supabase: { hz: 4, soloHz: 1, maxArena: 4, budget: 80, keepalive: 1.5 },
  relay: { hz: 10, soloHz: 2, maxArena: 16, keepalive: 1.5 },
};
export const PVP_AI_SHIPS = 3;        // local AI ships when you are alone in the arena (or waiting in the harbor); gone when a 2nd pirate joins
export const PVP_AFK = { kick: 180, warn: 30, farm: 60 }; // arena: no input for `kick` s = sent back to the harbor (warning for the last `warn` s), ALWAYS (queue or not). Sunk after `farm` s idle = no +100 bonus, no kill credit
export const PVP_OFFER = 15;          // seconds to accept 'Battle ready! Set sail?' when your queued slot opens (must match the lobby server)
export const PVP_ARENA_R = 420;       // metres from the arena centre you can sail
export const PVP_MAX_CARRY = 8000;    // most gold the host accepts as one player's death drop when it can't check their pickups
export const PVP_FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/pvp` : ''; // wallet-signed PvP save (Edge Function `pvp`)
// PvP skins unlock by LIFETIME PvP kills on real players (AI kills don't count). Cosmetic only, no stat changes.
// Skin looks live in assets/ships/pvp/*.js, wired in js/pvpSkins.js. Mirror any tier change in supabase/functions/pvp/lib.ts.
export const PVP_SKIN_TIERS = [
  { id: 'classic', name: 'DEFAULT', kills: 0 },
  { id: 'blood', name: 'CRIMSON SAILS', kills: 10 },
  { id: 'seagreen', name: 'SEA GREEN', kills: 25 },      // from the SALTY PIRATES mobile app skins
  { id: 'midnight', name: 'BLACK PEARL', kills: 50 },
  { id: 'golden', name: 'GOLDEN GALLEON', kills: 150 },
  { id: 'ghost', name: 'GHOST SHIP', kills: 300 },
  { id: 'kraken', name: 'KRAKEN INK', kills: 600 },      // mobile app
  { id: 'coral', name: 'CORAL REEF', kills: 1000 },      // mobile app
  { id: 'storm', name: 'STORM RIDER', kills: 1500 },     // mobile app
  { id: 'admiral', name: 'ADMIRAL WHITE', kills: 2000 }, // mobile app
  { id: 'flaming', name: 'FLAMING SHIP', kills: 2500 },
  { id: 'diamond', name: 'DIAMOND SHIP', kills: 5000 },  // Raul's diamond.js
];
// ---- PvP ECONOMY (harbor grind -> arena). SAME items / tiers / stats as solo (js/upgrades.js); solo prices unchanged. ----
// Harbor AI ships scale with your TOTAL upgrade level L (sum of all levels, 0..44): HP, size, damage and gold all grow
// with s(L) = 1 + HARBOR_SCALE_PER_LV·L, so bigger boats pay proportionally more. A PvP upgrade at tier index t costs
// what ~HARBOR_KILLS(t) harbor kills pay at the level you'd typically be at (L ≈ 7t, everything upgraded evenly):
//   kills(t) = base + amp·growth^t: cheap, fast catch-up early (50 / 56 / 64 kills for I-III), steep at the top
//   (98 / 129 for V-VI, 178 / 254 for CANNONS VII-VIII). The flat +100 death bonus of a player kill
//   ≈ 20 early harbor kills, ≈ 3 late ones. Mirror in supabase/functions/pvp/lib.ts (save plausibility value).
export const HARBOR_GOLD_BASE = 5;        // gold per harbor AI kill at L = 0
export const HARBOR_SCALE_PER_LV = 0.137; // +13.7% AI HP / gold per total upgrade level (L 42 ≈ ×6.75)
export const HARBOR_SIZE_PER_LV = 0.01;   // +1% AI hull size per level (L 42 ≈ ×1.42; the hitbox scales with it)
export const HARBOR_DMG_PER_LV = 0.02;    // +2% AI cannon damage per level (L 42 ≈ ×1.84)
export const HARBOR_HP_BASE = 70;         // AI hull HP at L = 0
export const HARBOR_KILLS = { base: 40, amp: 10, growth: 1.55 }; // harbor kills to afford tier index t: base + amp·growth^t (exponential-ish top)
export const harborKills = (t) => HARBOR_KILLS.base + HARBOR_KILLS.amp * Math.pow(HARBOR_KILLS.growth, t);
export const harborScale = (L) => 1 + HARBOR_SCALE_PER_LV * Math.max(0, L);
export const harborGold = (L) => Math.round(HARBOR_GOLD_BASE * harborScale(L));
export const PVP_TIER1_COST = 75; // BANKSY: level 1 of EVERY track costs 75 g (15 harbor kills at L0); higher tiers follow the curve
export const pvpTierCost = (t) => t === 0 ? PVP_TIER1_COST : Math.round(harborKills(t) * HARBOR_GOLD_BASE * harborScale(Math.min(7 * t, 42)) / 10) * 10; // same price in harbor + arena
// HARD CAP: each track stops at its last tier (6 levels, CANNONS 8; js/upgrades.js). Maxed = MAX in the shop; more gold buys no power.
// STREAK BOUNTY: every counted player kill in a row (no idle victim, not the same victim again within the anti-farm window,
// never AI) adds PVP_BOUNTY.perKill to your bounty, capped at PVP_BOUNTY.cap. Whoever sinks you collects it in your death
// pile (carried + 100 + bounty). Resets when you die or leave the arena. Rides in the normal state ('bt') + 'sunk' messages.
// HOLDER PERK (web build only; never on the crypto-free portal builds): a linked wallet (read-only signMessage) holding
// >= HOLDER_MIN_TOKENS $SUNK or $AHOY gets HOLDER_DAILY_GOLD once per America/Indianapolis day and ×HOLDER_GOLD_MUL on gold it
// EARNS (harbor AI gold, the +100 kill bonus); not on carried gold / bounties it picks up. The balance is checked server-side
// in the `pvp` Edge Function (cached ~10 min) and the daily claim is enforced there. Mirror: supabase/functions/pvp/lib.ts.
export const HOLDER_ENABLED = !ON_PORTAL;
export const HOLDER_MIN_TOKENS = 1, HOLDER_GOLD_MUL = 1.05, HOLDER_DAILY_GOLD = 100;
export const HOLDER_MINTS = { SUNK: 'By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump', AHOY: '39eBixffUCh2GqF8sEE9fZ1rqoeP2HxNsstN5X5ppump' };
export const PVP_BOUNTY = { perKill: 25, cap: 500, announce: 200, pairWindow: 120 };
export const PVP_REPAIR_COST = 40;    // repairs stay cheap in PvP (+50 HP, same as solo)
