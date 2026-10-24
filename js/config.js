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

// $AHOY token chip on the title screen (tap copies the full CA) + socials
export const AHOY_CA = '39eBixffUCh2GqF8sEE9fZ1rqoeP2HxNsstN5X5ppump';
export const AHOY_DEX_URL = 'https://dexscreener.com/solana/6x2dj4saq6fykuwz2q5pwej4kfsuqzcud5wrhmtv9zd4';
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
