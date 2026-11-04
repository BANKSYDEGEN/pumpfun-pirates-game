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
// LEGACY kill tiers (pre-shop, v101 and older): ONLY used to seed pvp_owned once for a pirate known before the island shop
// (index.ts devSync `known`) and to accept an equipped id. FROZEN at the old numbers on purpose: lowering them (the [prestige]
// GHOST 100 / FLAMING 200 kill goals below) must not hand out free skins. What makes a skin buyable is SHOP_ITEMS' goal.
// [v98] harbor-unlock skins (must match PVP_UNLOCK_SKINS in js/config.js): COMMODORE = 100 harbor boss kills
export const UNLOCK_SKINS: Record<string, { stat: "harborKills" | "bossKills"; need: number }> = { commodore: { stat: "bossKills", need: 100 } };
export const SKIN_KILLS: Record<string, number> = { classic: 0, blood: 10, seagreen: 25, midnight: 50, coral: 150, storm: 300, kraken: 600, golden: 1000, ghost: 1500, admiral: 2000, flaming: 2500, diamond: 5000 };
// plausibility caps per save (anti-cheat is modest: the client is trusted for its own ship in v1)
// a rejected save does NOT move updated_at, so a big legit pickup goes through a few seconds later as the allowance grows
// [v92] valuePerMin 2500 -> 10000: harbor pay ×2 and holder gold ×2 (up to ×4 for a holder), same headroom as before
// [v94] valueBase 300 -> 2500: a harbor boss pile (up to 840 g, ×2 for holders = 1,680) lands in one save
// [v98] harbor AI kills share the AI-kill pace; harbor bosses come every 3-5 min (one at a time)
// [security H3] valuePerMin 10000 -> 3000, bossPerMin 1 -> 0.5. Real pace (lib.ts WAVES_GOLD notes + the BR payouts): a mid
// player banks ~155 gold / min, x2 harbor pay x2 holder = ~620 / min; the best sustained pace seen is ~1,900 / min. 3,000 / min
// stays above every real player; a bigger one-off (a 1,680 g holder boss pile) is DELAYED a few syncs, never lost (stepToward
// clamps, saveProblem's 422 is retried as the allowance grows). Harbor bosses come one at a time every 3-5 min = at most 0.33 / min.
// valueBase stays 2500 (one boss pile in a single wallet save).
export const CAPS = { valueBase: 2500, valuePerMin: 3000, killsBase: 2, killsPerMin: 8, deathsBase: 2, deathsPerMin: 15, bossBase: 2, bossPerMin: 0.5 };

export const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const isWallet = (w: unknown): w is string => {
  if (typeof w !== "string" || !WALLET_RE.test(w)) return false;
  try { return bs58.decode(w).length === 32; } catch { return false; }
};
// [security H4] the sign-in text is now a Sign-In-With-Solana message bound to the page's domain: security.ts siwsMessage()

export function verifySignature(message: string, signatureB64: string, wallet: string): boolean {
  try {
    const sig = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
    const pub = bs58.decode(wallet);
    if (sig.length !== 64 || pub.length !== 32) return false;
    return nacl.sign.detached.verify(new TextEncoder().encode(message), sig, pub);
  } catch { return false; }
}

export type Profile = { gold: number; levels: Record<string, number>; skins: { owned: string[]; equipped: string }; gear?: Record<string, string>; stats: { kills: number; deaths: number; botKills: number; harborKills: number; bossKills: number; prestige?: number }; prestige?: number };
const n = (x: unknown, hi: number) => Math.max(0, Math.min(hi, Math.floor(Number(x) || 0)));
export function cleanProfile(p: any): Profile {
  const o = p && typeof p === "object" ? p : {};
  const levels: Record<string, number> = {};
  for (const [id, c] of Object.entries(TIER_COSTS)) levels[id] = n(o.levels?.[id], c.length);
  const stats = { kills: n(o.stats?.kills, 1e7), deaths: n(o.stats?.deaths, 1e7), botKills: n(o.stats?.botKills, 1e7), harborKills: n(o.stats?.harborKills, 1e7), bossKills: n(o.stats?.bossKills, 1e7) }; // [v98] unlock tracks
  // [v102] the island shop: owned skins come ONLY from pvp_owned (the handlers fill + check them: fitEquipped); here the
  // equipped id just has to be a known skin
  const eq = typeof o.skins?.equipped === "string" && (o.skins.equipped === "classic" || o.skins.equipped in SKIN_KILLS || o.skins.equipped in UNLOCK_SKINS) ? o.skins.equipped : "classic";
  // [prestige] the prestige level the client last saw (the server's pvp_prestige row decides; see stalePrestige)
  return { gold: n(o.gold, 10_000_000), levels, skins: { owned: [], equipped: eq }, stats, gear: cleanGear(o.gear), prestige: n(o.prestige, 100) } as Profile;
}
// total gold value held in a save: carried gold + what its upgrades cost (skins are cosmetic and also unlock in solo, so not counted)
export function value(p: Profile) {
  let v = p.gold;
  for (const [id, c] of Object.entries(TIER_COSTS)) for (let i = 0; i < Math.min(p.levels[id] || 0, c.length); i++) v += pvpTierCost(i);
  return v;
}
// Is going from `cur` to `next` plausible in `mins` minutes? Returns a reason string when not.
// [Emerly boosts] goldFind (0..0.10, the PET gold find from boostsFor) widens the gold pace by the same share (default 0 = unchanged)
export function saveProblem(cur: Profile, next: Profile, mins: number, goldFind = 0): string | null {
  const m = Math.max(0, Math.min(mins, 60)), gf = 1 + Math.max(0, Math.min(0.10, Number(goldFind) || 0));
  if (value(next) - value(cur) > CAPS.valueBase + CAPS.valuePerMin * gf * m) return "gold gained too fast";
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
// Skins + pirate gear are bought with Battle Royale gold. Goals make an item BUYABLE (BANKSY): COMMODORE 100 harbor boss kills,
// GHOST 100 kills, FLAMING ("FIRE") 200 kills; [prestige] GOLDEN (P1) / DIAMOND (P2) are the free exceptions (given). Items not listed
// here (all pirate gear until its model shows on the v4 pirate: COMING SOON) can't be bought at all.
export const OWNER_MAIN = "dev:e191a32e15abea4f14355121";
export type Goal = { stat: "kills" | "deaths" | "bossKills" | "harborKills" | "kd" | "prestige"; need: number }[];
export const SHOP_ITEMS: Record<string, { price: number; goal?: Goal }> = {
  "skin:blood": { price: 5000 }, "skin:seagreen": { price: 8000 }, "skin:midnight": { price: 12000 }, "skin:coral": { price: 18000 },
  "skin:storm": { price: 25000 }, "skin:kraken": { price: 40000 }, "skin:commodore": { price: 50000, goal: [{ stat: "bossKills", need: 100 }] },
  // [prestige] BANKSY: GOLDEN GALLEON = PRESTIGE 1, DIAMOND = PRESTIGE 2 (replace the 1,000 / 5,000 kill tiers), GHOST SHIP 100 kills,
  // FLAMING ("FIRE") 200 kills only (no K/D). GOLDEN / DIAMOND are GIVEN free on reaching that prestige (price 0; index.ts adds them to
  // pvp_owned on prestige + ownedSet counts them for anyone at that level). Anyone who already owns one keeps it (pvp_owned).
  "skin:golden": { price: 0, goal: [{ stat: "prestige", need: 1 }] }, "skin:ghost": { price: 100000, goal: [{ stat: "kills", need: 100 }] }, "skin:admiral": { price: 125000 },
  "skin:flaming": { price: 150000, goal: [{ stat: "kills", need: 200 }] },
  "skin:diamond": { price: 0, goal: [{ stat: "prestige", need: 2 }] },
  // [v108] pirate gear (Timothy's js/pirateGear.js + Raul's de13179 items). Goals checked server-side like COMMODORE.
  "gear:hat:bandana": { price: 150 }, "gear:hat:tricorn": { price: 400 }, "gear:hat:bicorne": { price: 1200 }, "gear:hat:crown": { price: 15000 }, "gear:hat:crown_imperial": { price: 25000 }, "gear:hat:helmet_hq": { price: 800 }, "gear:hat:mask_luchador": { price: 1500 },
  "gear:outfit:tank": { price: 150 }, "gear:outfit:tshirt": { price: 300 }, "gear:outfit:coat": { price: 1000 },
  "gear:outfit:shirt": { price: 300 }, "gear:outfit:suit": { price: 3000 }, "gear:outfit:singlet": { price: 600 },
  "gear:eyes:eyepatch": { price: 200 }, "gear:eyes:sunglasses": { price: 500 }, "gear:eyes:laser": { price: 3000 },
  "gear:parrot:parrot_green": { price: 2000 }, "gear:parrot:parrot_red": { price: 5000 },
  "gear:parrot:parrot_blue": { price: 8000 }, "gear:parrot:parrot_cockatoo": { price: 12000 },
  "gear:parrot:parrot_black": { price: 20000, goal: [{ stat: "kills", need: 1000 }] },
  "gear:parrot:parrot_gold": { price: 50000, goal: [{ stat: "bossKills", need: 50 }] },
  "gear:parrot:parrot_diamond": { price: 100000, goal: [{ stat: "kills", need: 5000 }] },
  "gear:hook:hook_iron": { price: 500 }, "gear:hook:hook_gold": { price: 2500 },
  "gear:leg:peg": { price: 1000 }, "gear:face:facepaint_retardio": { price: 350 },
  // [Timothy] CREW SHOP: crew versions of the real hats + clothes. PRICE RULE: = the player version (1:1). The crew uniform
  // (crewhat bandana + crewoutfit tank) is free (GEAR_SLOTS first id). 'gear:crew*:<id>' fits the pvp_owned item check: no migration.
  "gear:crewhat:tricorn": { price: 400 }, "gear:crewhat:bicorne": { price: 1200 }, "gear:crewhat:crown": { price: 15000 }, "gear:crewhat:crown_imperial": { price: 25000 }, "gear:crewhat:helmet_hq": { price: 800 },
  "gear:crewoutfit:tshirt": { price: 300 }, "gear:crewoutfit:coat": { price: 1000 }, "gear:crewoutfit:shirt": { price: 300 }, "gear:crewoutfit:suit": { price: 3000 },
  // [Timothy] WEAPON STORE: cosmetic swords (SWORD PIT) + muskets (MUSKET RANGE), BANKSY's prices + goals; the rusty cutlass + rusty
  // flintlock are free (GEAR_SLOTS.sword[0] / .musket[0]). Pit / range KOs never reach pvp_claim_kill, so they can't feed these goals.
  "gear:sword:cutlass": { price: 1500 }, "gear:sword:rapier": { price: 4000 }, "gear:sword:bone": { price: 12000 },
  "gear:sword:sabre_gilded": { price: 25000, goal: [{ stat: "bossKills", need: 25 }] },
  "gear:sword:blade_gold": { price: 75000, goal: [{ stat: "kills", need: 2000 }] },
  "gear:musket:navy": { price: 2000 }, "gear:musket:blunder": { price: 5000 }, "gear:musket:dragoon": { price: 12000 },
  "gear:musket:bone": { price: 25000, goal: [{ stat: "bossKills", need: 25 }] },
  "gear:musket:blunder_gold": { price: 75000, goal: [{ stat: "kills", need: 2000 }] },
  // [Raul shop items 2] PROPOSED prices (BANKSY OKs them; mirror js/shopCatalog.js). Cosmetic only, no BOOSTS entries.
  "gear:beard:beard_moustache": { price: 400 }, "gear:beard:beard_forked": { price: 900 }, "gear:beard:beard_black": { price: 2500 }, "gear:ears:earring_hoop": { price: 250 }, "gear:ears:earring_double": { price: 600 }, "gear:ears:earring_skull": { price: 1200 }, "gear:teeth:tooth_gold": { price: 300 }, "gear:teeth:grill_gold": { price: 1500 }, "gear:teeth:grill_diamond": { price: 6000 }, "gear:boots:boots_buckle": { price: 350 }, "gear:boots:boots_cavalier": { price: 1000 }, "gear:boots:boots_gold": { price: 3000 }, "gear:cape:cape_tattered": { price: 800 }, "gear:cape:cape_captain": { price: 2000 }, "gear:cape:cape_royal": { price: 8000 }, "gear:parrot:pet_cat": { price: 3000 }, "gear:parrot:pet_monkey": { price: 4000 }, "gear:parrot:pet_cat_black": { price: 6000 }, "gear:leg:peg_gold": { price: 30000 }, "gear:leg:peg_kraken": { price: 45000 }, "gear:leg:peg_ghost": { price: 60000 } /* [Raul pegs 2] PROPOSED, not OK'd yet */, "gear:flag:flag_cutlass": { price: 1000 }, "gear:flag:flag_red": { price: 2500 }, "gear:flag:flag_gold": { price: 7500 }, "gear:figure:fig_mermaid": { price: 5000 }, "gear:figure:fig_kraken": { price: 9000 }, "gear:figure:fig_lion": { price: 15000 },
};
export const SHOP_SKINS = Object.keys(SHOP_ITEMS).filter((k) => k.startsWith("skin:")).map((k) => k.slice(5));
export const GEAR_SLOTS: Record<string, string[]> = { hat: ["none", "bandana", "tricorn", "bicorne", "crown", "crown_imperial", "helmet_hq", "mask_luchador"], outfit: ["shirtless", "tank", "tshirt", "coat", "shirt", "suit", "singlet"], eyes: ["plain", "eyepatch", "sunglasses", "laser"],
  parrot: ["none", "parrot_green", "parrot_red", "parrot_gold", "parrot_blue", "parrot_cockatoo", "parrot_black", "parrot_diamond", "pet_monkey", "pet_cat", "pet_cat_black"], hook: ["none", "hook_iron", "hook_gold"],
  leg: ["none", "peg", "peg_gold", "peg_kraken", "peg_ghost"], face: ["none", "facepaint_retardio"],
  // [Raul shop items 2] new slots (a row without them = none). APPEND-ONLY. The OWNER owns every id here (ownedLists).
  beard: ["none", "beard_moustache", "beard_forked", "beard_black"], ears: ["none", "earring_hoop", "earring_double", "earring_skull"], teeth: ["none", "tooth_gold", "grill_gold", "grill_diamond"], boots: ["none", "boots_buckle", "boots_cavalier", "boots_gold"], cape: ["none", "cape_tattered", "cape_captain", "cape_royal"], flag: ["none", "flag_cutlass", "flag_red", "flag_gold"], figure: ["none", "fig_mermaid", "fig_kraken", "fig_lion"],
  // [Timothy] CREW SHOP: the crew's OWN loadout (stored in the same gear jsonb: gear.crewhat / gear.crewoutfit; a row without them =
  // the free uniform, ids[0]). The crew no longer copy the captain's hat + clothes. APPEND-ONLY (js/crewLoadout.js CREW_SLOTS).
  crewhat: ["bandana", "tricorn", "bicorne", "crown", "crown_imperial", "helmet_hq"], crewoutfit: ["tank", "tshirt", "coat", "shirt", "suit"],
  // [Timothy] WEAPON STORE sword + musket (a row without them = the free rusty cutlass / flintlock). APPEND-ONLY (js/onfoot/swords.js).
  sword: ["rusty", "cutlass", "rapier", "bone", "sabre_gilded", "blade_gold"], musket: ["rusty", "navy", "blunder", "dragoon", "bone", "blunder_gold"] }; // equip validation (owned or free). The OWNER owns every id here automatically (index.ts ownedLists + fitEquipped(owner)).
export const SEED_GOLD_CAP = 5000; // [security H3] was 25000. First server copy of a device save: gold above this is released at the normal earning pace (stepToward)
const statOf = (st: Profile["stats"], k: string) => k === "kd" ? st.kills / Math.max(1, st.deaths) : Math.max(0, Number((st as any)[k]) || 0);
export const goalMet = (goal: Goal | undefined, st: Profile["stats"]) => !goal || goal.every((g) => statOf(st, g.stat) >= g.need);
export const HAT_COLORS = 12; // [v105] free hat colour pick: 0 = the hat's default, 1..12 = Timothy's HAT_SWATCHES
export function cleanGear(g: any): Record<string, any> { const o: Record<string, any> = {};
  for (const [s, ids] of Object.entries(GEAR_SLOTS)) o[s] = typeof g?.[s] === "string" && ids.includes(g[s]) ? g[s] : ids[0];
  const h = Math.floor(Number(g?.hatColor)); o.hatColor = Number.isFinite(h) && h >= 0 && h <= HAT_COLORS ? h : 0;
  const ch = Math.floor(Number(g?.crewhatColor)); if (Number.isFinite(ch) && ch > 0 && ch <= HAT_COLORS) o.crewhatColor = ch; return o; } // [Raul gear colours] the crew's free hat colour (additive: only when picked; js/crewLoadout.js)
// owned list -> the equipped skin / gear a save may keep (free defaults always ok)
export function fitEquipped(p: Profile, owned: Set<string>, owner: boolean) {
  const eq = p.skins.equipped; p.skins.equipped = eq === "classic" || owner || owned.has("skin:" + eq) ? eq : "classic";
  const g = cleanGear((p as any).gear); for (const [s, ids] of Object.entries(GEAR_SLOTS)) if (g[s] !== ids[0] && !owner && !owned.has(`gear:${s}:${g[s]}`)) g[s] = ids[0]; // hatColor is free
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

// ---------------- [v105] TREASURE MAPS (BANKSY) ----------------
// dig spots (js/island/foot.js DIGS ids; 'cave' = the Skull Peak treasure cave, legendary maps only). APPEND-ONLY.
// [island-rework] now GENERATED from the shared registry js/island/digSpots.js (tools/gen_digspots.mjs -> ./digSpots.ts); same values as before:
// MAP_SPOTS = dig1..dig6, MAP_SPOTS_ALL = dig1..dig6 + cave. New island spots are registered OFF until each area ships.
export { MAP_SPOTS, MAP_SPOTS_ALL } from "./digSpots.ts";

// ---------------- [Emerly] ITEM SKILL BOOSTS (BANKSY, Nov 3; plan timothy-boosts/PLAN.md). ADDITIVE: no migration. ----------------
// Server copy of js/boosts.js BOOSTS (tests/boosts_test.mjs checks the two tables match). Boosts = equipped gear ∩ pvp_owned
// (the owner owns everything, still CAPPED). The server applies GOLD FIND to the gold it pays (waves_claim) and widens the save
// pace check by it; combat boosts ride the same trust as upgrade levels (the client runs its own ship).
export const BOOST_CAPS: Record<string, number> = { reload: 0.06, hp: 0.05, range: 0.05, dmg: 0.04, turn: 0.04, speed: 0.05, regen: 0.08, goldFind: 0.10, digLuck: 0.15, swordHit: 0.04, musketHit: 0.05 };
const BOOST_COMBAT = ["reload", "hp", "range", "dmg", "turn", "speed", "regen"];
export const BOOST_COMBAT_CAP = 0.30;
export const BOOSTS: Record<string, Record<string, number>> = {
  "hat:bandana": { reload: 0.01 }, "hat:tricorn": { reload: 0.02 }, "hat:helmet_hq": { reload: 0.03 }, "hat:bicorne": { reload: 0.04 },
  "hat:crown": { reload: 0.05 }, "hat:crown_imperial": { reload: 0.06 },
  "outfit:tank": { hp: 0.01 }, "outfit:tshirt": { hp: 0.02 }, "outfit:shirt": { hp: 0.02 }, "outfit:coat": { hp: 0.03 }, "outfit:suit": { hp: 0.05 },
  "eyes:eyepatch": { range: 0.02 }, "eyes:sunglasses": { range: 0.03 }, "eyes:laser": { range: 0.05 },
  "hook:hook_iron": { dmg: 0.02 }, "hook:hook_gold": { dmg: 0.04 },
  "leg:peg": { turn: 0.04 },
  "face:facepaint_retardio": { speed: 0.02 },
  "crewhat:tricorn": { speed: 0.01 }, "crewhat:helmet_hq": { speed: 0.015 }, "crewhat:bicorne": { speed: 0.02 }, "crewhat:crown": { speed: 0.03 }, "crewhat:crown_imperial": { speed: 0.035 },
  "crewoutfit:tshirt": { regen: 0.03 }, "crewoutfit:shirt": { regen: 0.03 }, "crewoutfit:coat": { regen: 0.05 }, "crewoutfit:suit": { regen: 0.08 },
  "parrot:parrot_green": { goldFind: 0.02 }, "parrot:parrot_red": { goldFind: 0.03 }, "parrot:parrot_blue": { goldFind: 0.04 },
  "parrot:parrot_cockatoo": { goldFind: 0.05, digLuck: 0.05 }, "parrot:parrot_black": { goldFind: 0.06, digLuck: 0.08 },
  "parrot:parrot_gold": { goldFind: 0.08, digLuck: 0.12 }, "parrot:parrot_diamond": { goldFind: 0.10, digLuck: 0.15 },
  // swords + muskets: their OWN on-foot hit rate (BANKSY 5:29 PM), never ship stats. They count once GEAR_SLOTS has sword / musket.
  "sword:cutlass": { swordHit: 0.01 }, "sword:rapier": { swordHit: 0.015 }, "sword:bone": { swordHit: 0.02 }, "sword:sabre_gilded": { swordHit: 0.03 }, "sword:blade_gold": { swordHit: 0.04 },
  "musket:navy": { musketHit: 0.01 }, "musket:blunder": { musketHit: 0.02 }, "musket:dragoon": { musketHit: 0.03 }, "musket:bone": { musketHit: 0.04 }, "musket:blunder_gold": { musketHit: 0.05 },
};
const r4 = (v: number) => Math.round(v * 10000) / 10000;
// gear (any shape: cleaned here) + the pvp_owned set ('gear:slot:id') -> capped boosts. Never throws.
export function boostsFor(gear: unknown, owned: Set<string>, owner: boolean): Record<string, number> {
  const g = cleanGear(gear), raw: Record<string, number> = Object.fromEntries(Object.keys(BOOST_CAPS).map((k) => [k, 0]));
  for (const [slot, id] of Object.entries(g)) {
    const b = typeof id === "string" ? BOOSTS[`${slot}:${id}`] : undefined; if (!b) continue;
    if (!owner && !owned.has(`gear:${slot}:${id}`)) continue;
    for (const [k, v] of Object.entries(b)) raw[k] += v;
  }
  const out: Record<string, number> = {}; for (const [k, cap] of Object.entries(BOOST_CAPS)) out[k] = Math.min(raw[k], cap);
  const combat = BOOST_COMBAT.reduce((a, k) => a + out[k], 0);
  if (combat > BOOST_COMBAT_CAP) { const f = BOOST_COMBAT_CAP / combat; for (const k of BOOST_COMBAT) out[k] *= f; }
  for (const k of Object.keys(out)) out[k] = r4(out[k]);
  out.combat = r4(Math.min(BOOST_COMBAT_CAP, combat)); out.ver = 1;
  return out;
}
// ---------------- [prestige] PRESTIGE (BANKSY: "Add ability to prestige when max out ship") ----------------
// Every upgrade track at its top level -> PRESTIGE: the level goes up by one (pvp_prestige, migration 031) and ONLY the ship upgrades
// go back to base. PRESTIGE_MAX = the top level of each track (= TIER_COSTS lengths = js/upgrades.js tiers).
export const PRESTIGE_MAX: Record<string, number> = Object.fromEntries(Object.entries(TIER_COSTS).map(([k, c]) => [k, c.length]));
export const maxedLevels = (lv: Record<string, number>) => Object.entries(PRESTIGE_MAX).every(([k, m]) => (Number(lv?.[k]) || 0) >= m);
// a save from a device that has not seen the latest prestige (its `prestige` is lower than the server's) may not bring its old
// upgrade levels back: true = ignore that save's levels (keep the server's). Older clients send no prestige (= 0): fine at 0.
// [prestige] BANKSY: the skins a prestige level GIVES (mirror: js/prestige.js PRESTIGE_REWARDS). Only ever ADDED to pvp_owned.
export const PRESTIGE_SKINS: Record<number, string> = { 1: "skin:golden", 2: "skin:diamond" };
export const prestigeSkins = (lv: number) => Object.entries(PRESTIGE_SKINS).filter(([n]) => (Number(lv) || 0) >= Number(n)).map(([, it]) => it);
export const stalePrestige = (sent: number | undefined, server: number) => server > 0 && (Number(sent) || 0) < server;
