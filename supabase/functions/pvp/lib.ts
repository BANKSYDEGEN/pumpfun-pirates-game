// PUMPFUN PIRATES · `pvp` Edge Function helpers. Read-only wallet sign-in (signMessage of plain text): nothing here
// ever builds, requests or relays a transaction.
import nacl from "npm:tweetnacl@1.0.3";
import bs58 from "npm:bs58@6.0.0";

// PvP upgrade cost by tier index (must match js/config.js pvpTierCost / HARBOR_*); TIER_COSTS = solo costs, used for tier counts
const HARBOR_GOLD_BASE = 5, HARBOR_SCALE_PER_LV = 0.137, HARBOR_KILLS = { base: 40, amp: 10, growth: 1.55 };
export const PVP_TIER1_COST = 75; // level 1 of every track (js/config.js PVP_TIER1_COST)
export const pvpTierCost = (t: number) => t === 0 ? PVP_TIER1_COST : Math.round((HARBOR_KILLS.base + HARBOR_KILLS.amp * Math.pow(HARBOR_KILLS.growth, t)) * HARBOR_GOLD_BASE * (1 + HARBOR_SCALE_PER_LV * Math.min(7 * t, 42)) / 10) * 10;
export const TIER_COSTS: Record<string, number[]> = {
  hull: [20, 25, 70, 120, 180, 250], armor: [25, 30, 80, 130, 190, 260], sails: [25, 30, 80, 120, 170, 230],
  rudder: [20, 25, 65, 100, 145, 200], cannons: [30, 45, 80, 120, 165, 220, 280, 350], reload: [25, 30, 85, 135, 195, 270],
  range: [25, 30, 80, 120, 170, 230],
};
// HOLDER PERK (must match js/config.js HOLDER_*): >= HOLDER_MIN_TOKENS of either mint = holder. Read-only balance lookup.
export const HOLDER_MINTS: Record<string, string> = { sunk: "By1Nd4iQ3dwdfS6SSepg5PmMXifghR8skw3p2p6Bpump", ahoy: "39eBixffUCh2GqF8sEE9fZ1rqoeP2HxNsstN5X5ppump" };
export const HOLDER_MIN_TOKENS = 1, HOLDER_DAILY_GOLD = 100, HOLDER_CACHE_MS = 10 * 60 * 1000;
// sum of a wallet's balance of one mint via getTokenAccountsByOwner (jsonParsed). Throws on any RPC problem (callers fail closed).
export async function tokenBalance(rpc: string, owner: string, mint: string): Promise<number> {
  const r = await fetch(rpc, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(6000),
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenAccountsByOwner", params: [owner, { mint }, { encoding: "jsonParsed", commitment: "confirmed" }] }) });
  if (!r.ok) throw new Error(`rpc ${r.status}`);
  const j = await r.json(); if (j.error || !Array.isArray(j.result?.value)) throw new Error("rpc error");
  return j.result.value.reduce((a: number, v: any) => a + (Number(v?.account?.data?.parsed?.info?.tokenAmount?.uiAmount) || 0), 0);
}
// PvP skins unlock by lifetime player kills (must match PVP_SKIN_TIERS in js/config.js)
// [v98] harbor-unlock skins (must match PVP_UNLOCK_SKINS in js/config.js): COMMODORE = 100 harbor boss kills
export const UNLOCK_SKINS: Record<string, { stat: "harborKills" | "bossKills"; need: number }> = { commodore: { stat: "bossKills", need: 100 } };
export const SKIN_KILLS: Record<string, number> = { classic: 0, blood: 10, seagreen: 25, midnight: 50, coral: 150, storm: 300, kraken: 600, golden: 1000, ghost: 1500, admiral: 2000, flaming: 2500, diamond: 5000 };
// plausibility caps per save (anti-cheat is modest: the client is trusted for its own ship in v1)
// a rejected save does NOT move updated_at, so a big legit pickup goes through a few seconds later as the allowance grows
// [v92] valuePerMin 2500 -> 10000: harbor pay ×2 and holder gold ×2 (up to ×4 for a holder), same headroom as before
// [v94] valueBase 300 -> 2500: a harbor boss pile (up to 840 g, ×2 for holders = 1,680) lands in one save
// [v98] harbor AI kills share the AI-kill pace; harbor bosses come every 3-5 min (one at a time)
export const CAPS = { valueBase: 2500, valuePerMin: 10000, killsBase: 2, killsPerMin: 8, deathsBase: 2, deathsPerMin: 15, bossBase: 2, bossPerMin: 1 };

export const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const isWallet = (w: unknown): w is string => {
  if (typeof w !== "string" || !WALLET_RE.test(w)) return false;
  try { return bs58.decode(w).length === 32; } catch { return false; }
};
export const buildMessage = (wallet: string, nonce: string, issued: string) =>
  `PUMPFUN PIRATES PvP save\nwallet: ${wallet}\nnonce: ${nonce}\nissued: ${issued}\nRead-only: this is not a transaction and cannot move funds.`;

export function verifySignature(message: string, signatureB64: string, wallet: string): boolean {
  try {
    const sig = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
    const pub = bs58.decode(wallet);
    if (sig.length !== 64 || pub.length !== 32) return false;
    return nacl.sign.detached.verify(new TextEncoder().encode(message), sig, pub);
  } catch { return false; }
}

export type Profile = { gold: number; levels: Record<string, number>; skins: { owned: string[]; equipped: string }; gear?: Record<string, string>; stats: { kills: number; deaths: number; botKills: number; harborKills: number; bossKills: number } };
const n = (x: unknown, hi: number) => Math.max(0, Math.min(hi, Math.floor(Number(x) || 0)));
export function cleanProfile(p: any): Profile {
  const o = p && typeof p === "object" ? p : {};
  const levels: Record<string, number> = {};
  for (const [id, c] of Object.entries(TIER_COSTS)) levels[id] = n(o.levels?.[id], c.length);
  const stats = { kills: n(o.stats?.kills, 1e7), deaths: n(o.stats?.deaths, 1e7), botKills: n(o.stats?.botKills, 1e7), harborKills: n(o.stats?.harborKills, 1e7), bossKills: n(o.stats?.bossKills, 1e7) }; // [v98] unlock tracks
  // [v102] the island shop: owned skins come ONLY from pvp_owned (the handlers fill + check them: fitEquipped); here the
  // equipped id just has to be a known skin
  const eq = typeof o.skins?.equipped === "string" && (o.skins.equipped === "classic" || o.skins.equipped in SKIN_KILLS || o.skins.equipped in UNLOCK_SKINS) ? o.skins.equipped : "classic";
  return { gold: n(o.gold, 10_000_000), levels, skins: { owned: [], equipped: eq }, stats, gear: cleanGear(o.gear) } as Profile;
}
// total gold value held in a save: carried gold + what its upgrades cost (skins are cosmetic and also unlock in solo, so not counted)
export function value(p: Profile) {
  let v = p.gold;
  for (const [id, c] of Object.entries(TIER_COSTS)) for (let i = 0; i < Math.min(p.levels[id] || 0, c.length); i++) v += pvpTierCost(i);
  return v;
}
// Is going from `cur` to `next` plausible in `mins` minutes? Returns a reason string when not.
export function saveProblem(cur: Profile, next: Profile, mins: number): string | null {
  const m = Math.max(0, Math.min(mins, 60));
  if (value(next) - value(cur) > CAPS.valueBase + CAPS.valuePerMin * m) return "gold gained too fast";
  const dk = next.stats.kills - cur.stats.kills, dd = next.stats.deaths - cur.stats.deaths, db = next.stats.botKills - cur.stats.botKills;
  if (dk < 0 || dd < 0 || db < 0) return "K/D can't go down";
  if (dk > CAPS.killsBase + CAPS.killsPerMin * m || db > CAPS.killsBase + CAPS.killsPerMin * m) return "too many kills for the time";
  if (dd > CAPS.deathsBase + CAPS.deathsPerMin * m) return "too many deaths for the time";
  // [v98] unlock tracks (harbor AI / boss kills): never down (an older client that doesn't send them keeps the stored count, see
  // keepCounters), and no faster than the harbor can pay out
  const dh = next.stats.harborKills - cur.stats.harborKills, dbo = next.stats.bossKills - cur.stats.bossKills;
  if (dh > CAPS.killsBase + CAPS.killsPerMin * m) return "too many harbor kills for the time";
  if (dbo > CAPS.bossBase + CAPS.bossPerMin * m) return "too many boss kills for the time";
  return null;
}
// [v98] the unlock counters only ever go up: a save without them (pre-v98 client) or with a lower number keeps the stored one
export function keepCounters(cur: Profile, next: Profile): Profile {
  next.stats.harborKills = Math.max(cur.stats.harborKills, next.stats.harborKills);
  next.stats.bossKills = Math.max(cur.stats.bossKills, next.stats.bossKills);
  return cleanProfile(next);
}

// ---------------- [v102] THE ISLAND SHOP (server copy; js/shopCatalog.js only draws the shop, THIS decides) ----------------
// Skins + pirate gear are bought with Battle Royale gold. Goals make an item BUYABLE, never free (BANKSY): COMMODORE 100 harbor
// boss kills, FLAMING ("FIRE") K/D >= 10 with at least 50 kills, DIAMOND keeps its 5,000 kills (Solo + Squads). Items not listed
// here (all pirate gear until its model shows on the v4 pirate: COMING SOON) can't be bought at all.
export const OWNER_MAIN = "dev:e191a32e15abea4f14355121";
export type Goal = { stat: "kills" | "deaths" | "bossKills" | "harborKills" | "kd"; need: number }[];
export const SHOP_ITEMS: Record<string, { price: number; goal?: Goal }> = {
  "skin:blood": { price: 5000 }, "skin:seagreen": { price: 8000 }, "skin:midnight": { price: 12000 }, "skin:coral": { price: 18000 },
  "skin:storm": { price: 25000 }, "skin:kraken": { price: 40000 }, "skin:commodore": { price: 50000, goal: [{ stat: "bossKills", need: 100 }] },
  "skin:golden": { price: 75000 }, "skin:ghost": { price: 100000 }, "skin:admiral": { price: 125000 },
  "skin:flaming": { price: 150000, goal: [{ stat: "kd", need: 10 }, { stat: "kills", need: 50 }] },
  "skin:diamond": { price: 250000, goal: [{ stat: "kills", need: 5000 }] },
  // pirate gear (js/shopCatalog.js ids, Timothy's prices) goes on sale here once its model shows on the v4 pirate, e.g.
  // "gear:hat:bandana": { price: 150 }, "gear:hat:tricorn": { price: 400 }, "gear:hat:bicorne": { price: 1200 }, "gear:outfit:tank": { price: 150 }, ...
};
export const SHOP_SKINS = Object.keys(SHOP_ITEMS).filter((k) => k.startsWith("skin:")).map((k) => k.slice(5));
export const GEAR_SLOTS: Record<string, string[]> = { hat: ["none", "bandana", "tricorn", "bicorne"], outfit: ["shirtless", "tank", "tshirt", "coat"], eyes: ["plain", "eyepatch", "sunglasses", "laser"],
  parrot: ["none", "parrot_green", "parrot_red", "parrot_gold"], hook: ["none", "hook_iron", "hook_gold"] }; // equip validation (owned or free)
export const SEED_GOLD_CAP = 25000; // first server copy of a device save: gold above this is released at the normal earning pace
const statOf = (st: Profile["stats"], k: string) => k === "kd" ? st.kills / Math.max(1, st.deaths) : Math.max(0, Number((st as any)[k]) || 0);
export const goalMet = (goal: Goal | undefined, st: Profile["stats"]) => !goal || goal.every((g) => statOf(st, g.stat) >= g.need);
export function cleanGear(g: any): Record<string, string> { const o: Record<string, string> = {};
  for (const [s, ids] of Object.entries(GEAR_SLOTS)) o[s] = typeof g?.[s] === "string" && ids.includes(g[s]) ? g[s] : ids[0]; return o; }
// owned list -> the equipped skin / gear a save may keep (free defaults always ok)
export function fitEquipped(p: Profile, owned: Set<string>, owner: boolean) {
  const eq = p.skins.equipped; p.skins.equipped = eq === "classic" || owner || owned.has("skin:" + eq) ? eq : "classic";
  const g = cleanGear((p as any).gear); for (const [s, ids] of Object.entries(GEAR_SLOTS)) if (g[s] !== ids[0] && !owner && !owned.has(`gear:${s}:${g[s]}`)) g[s] = ids[0];
  (p as any).gear = g; return p;
}

// ---------------- [v103] WAVES PAYS GOLD FROM SCORE (BANKSY) ----------------
// banked gold = round(16 * sqrt(score)), at most 6,000 a run (x2 holder / owner, like every earned gold); 30,000 base gold a day max.
// Tuned on the real Waves board (scores vs run length) to land near the BR pace (~9.3k gold / hour for a mid player = ~155 / min):
// 3 min run ~1,000 pts -> 500 (~150/min) · 7 min ~2,800 -> 840 (~127/min) · 11 min ~13,000 -> 1,825 (~166/min)
// 27 min ~27,000 -> 2,620 (~98/min) · 33 min ~55,000 -> 3,766 (~114/min) · 38 min ~88,000 -> 4,736 (~126/min). sqrt = diminishing returns.
export const WAVES_GOLD = { k: 16, cap: 6000, dayCap: 30000, minRunS: 20, maxRunH: 6 };
export const wavesGold = (score: number) => Math.min(WAVES_GOLD.cap, Math.round(WAVES_GOLD.k * Math.sqrt(Math.max(0, score))));
// the leaderboard's own limits (schema.sql: score <= 1,000,000, wave <= 500, sunk <= duration / 5) + a score pace no real run
// reaches (best runs: ~50 points / s), against the SERVER-measured run length
export function wavesProblem(score: number, wave: number, sunk: number, elapsed: number): string | null {
  if (!(score >= 0 && score <= 1_000_000 && wave >= 0 && wave <= 500 && sunk >= 0 && sunk <= 5000)) return "bad run";
  if (sunk > Math.max(1, elapsed / 5)) return "too many sinks for the time";
  if (score > 500 + 75 * elapsed) return "score too fast";
  if (wave > 2 + elapsed / 15) return "waves too fast";
  return null;
}
