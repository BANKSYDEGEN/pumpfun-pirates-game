// PUMPFUN PIRATES · `pvp` Edge Function helpers. Read-only wallet sign-in (signMessage of plain text): nothing here
// ever builds, requests or relays a transaction.
import nacl from "npm:tweetnacl@1.0.3";
import bs58 from "npm:bs58@6.0.0";

// PvP upgrade cost by tier index (must match js/config.js pvpTierCost / HARBOR_*); TIER_COSTS = solo costs, used for tier counts
const HARBOR_GOLD_BASE = 5, HARBOR_SCALE_PER_LV = 0.137, HARBOR_KILLS = { base: 40, amp: 10, growth: 1.55 };
export const pvpTierCost = (t: number) => Math.round((HARBOR_KILLS.base + HARBOR_KILLS.amp * Math.pow(HARBOR_KILLS.growth, t)) * HARBOR_GOLD_BASE * (1 + HARBOR_SCALE_PER_LV * Math.min(7 * t, 42)) / 10) * 10;
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
export const SKIN_KILLS: Record<string, number> = { classic: 0, blood: 10, seagreen: 25, midnight: 50, golden: 150, ghost: 300, kraken: 600, coral: 1000, storm: 1500, admiral: 2000, flaming: 2500, diamond: 5000 };
// plausibility caps per save (anti-cheat is modest: the client is trusted for its own ship in v1)
// a rejected save does NOT move updated_at, so a big legit pickup goes through a few seconds later as the allowance grows
export const CAPS = { valueBase: 300, valuePerMin: 2500, killsBase: 2, killsPerMin: 8, deathsBase: 2, deathsPerMin: 15 };

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

export type Profile = { gold: number; levels: Record<string, number>; skins: { owned: string[]; equipped: string }; stats: { kills: number; deaths: number; botKills: number } };
const n = (x: unknown, hi: number) => Math.max(0, Math.min(hi, Math.floor(Number(x) || 0)));
export function cleanProfile(p: any): Profile {
  const o = p && typeof p === "object" ? p : {};
  const levels: Record<string, number> = {};
  for (const [id, c] of Object.entries(TIER_COSTS)) levels[id] = n(o.levels?.[id], c.length);
  const stats = { kills: n(o.stats?.kills, 1e7), deaths: n(o.stats?.deaths, 1e7), botKills: n(o.stats?.botKills, 1e7) };
  // unlocked skins come ONLY from the kill count; the selected one must be unlocked
  const owned = Object.keys(SKIN_KILLS).filter((id) => id !== "classic" && stats.kills >= SKIN_KILLS[id]);
  const eq = typeof o.skins?.equipped === "string" && (o.skins.equipped === "classic" || owned.includes(o.skins.equipped)) ? o.skins.equipped : "classic";
  return { gold: n(o.gold, 10_000_000), levels, skins: { owned, equipped: eq }, stats };
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
  return null;
}
