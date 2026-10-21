// PUMPFUN PIRATES · `pirate` Edge Function logic (pure helpers, imported by index.ts and the tests).
// Read-only wallet sign-in: the wallet signs a plain-text message (signMessage). Nothing here ever builds,
// requests or relays a transaction, and no key or seed phrase is ever involved.
import nacl from "npm:tweetnacl@1.0.3";
import bs58 from "npm:bs58@6.0.0";

// skin ids + prices (must match js/skins.js); classic is free
export const SKIN_PRICES: Record<string, number> = { classic: 0, parchment: 150, blood: 250, midnight: 400, navy: 600, degen: 800, ghost: 1100, golden: 1600 };

export const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const isWallet = (w: unknown): w is string => {
  if (typeof w !== "string" || !WALLET_RE.test(w)) return false;
  try { return bs58.decode(w).length === 32; } catch { return false; }
};

export function buildMessage(domain: string, wallet: string, nonce: string, issuedAt: string, expiresAt: string) {
  return [
    `${domain} wants you to sign in with your Solana account:`,
    wallet,
    "",
    "Sign in to PUMPFUN PIRATES to save your progress.",
    "Read-only: this only proves you own this wallet. It is not a transaction and cannot move funds or approve anything.",
    "",
    `URI: https://${domain}`,
    "Version: 1",
    "Chain ID: mainnet",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expiresAt}`,
  ].join("\n");
}

export function verifySignature(message: string, signatureB64: string, wallet: string): boolean {
  try {
    const sig = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
    const pub = bs58.decode(wallet);
    if (sig.length !== 64 || pub.length !== 32) return false;
    return nacl.sign.detached.verify(new TextEncoder().encode(message), sig, pub);
  } catch { return false; }
}

// ---------------- progress sanitising + modest anti-cheat ----------------
export type Progress = { skins: { owned: string[]; equipped: string }; best: { score: number; wave: number }; cur_run?: { id: string; added: string[]; final?: boolean } };
export function cleanSkins(v: unknown): { owned: string[]; equipped: string } {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const owned = [...new Set((Array.isArray(o.owned) ? o.owned : []).filter((x) => typeof x === "string" && x in SKIN_PRICES && x !== "classic"))] as string[];
  const eq = typeof o.equipped === "string" && (o.equipped === "classic" || owned.includes(o.equipped)) ? o.equipped : "classic";
  return { owned, equipped: eq };
}
export function cleanProgress(v: unknown): Progress {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const b = (o.best && typeof o.best === "object" ? o.best : {}) as Record<string, unknown>;
  const n = (x: unknown, hi: number) => Math.max(0, Math.min(hi, Math.floor(Number(x) || 0)));
  const p: Progress = { skins: cleanSkins(o.skins), best: { score: n(b.score, 1_000_000), wave: n(b.wave, 500) } };
  if (o.cur_run && typeof o.cur_run === "object") p.cur_run = o.cur_run as Progress["cur_run"];
  return p;
}
export type Run = { id: string; score: number; wave: number; sunk: number; duration_s: number; gold_base: number; gold_total: number; over: boolean };
export function cleanRun(v: unknown): Run | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const int = (x: unknown, hi: number) => { const k = Math.floor(Number(x)); return Number.isFinite(k) && k >= 0 && k <= hi ? k : -1; };
  const r = { id: String(o.id ?? "").slice(0, 40), score: int(o.score, 1_000_000), wave: int(o.wave, 500), sunk: int(o.sunk, 5000), duration_s: int(o.duration_s, 86400), gold_base: int(o.gold_base, 10_000_000), gold_total: int(o.gold_total, 10_000_000), over: !!o.over };
  if (!/^[a-z0-9]{8,40}$/.test(r.id) || [r.score, r.wave, r.sunk, r.duration_s, r.gold_base, r.gold_total].some((x) => x < 0)) return null;
  return r;
}
// The most gold a run can plausibly have looted. Every gold pickup also adds the same amount to the score,
// so un-boosted gold can never exceed the score; and per sink the richest drop is a runner's 3 chests.
export function goldCap(r: Run) { return Math.min(r.score, (r.sunk + 2) * 3 * (70 + 12 * Math.max(1, r.wave))); }
// Same crude plausibility the scores table uses: at most ~1 sink every 5 s.
export function runProblem(r: Run): string | null {
  if (r.sunk > Math.max(1, Math.floor(r.duration_s / 5)) + 1) return "implausible sinks for the run time";
  if (r.gold_base > goldCap(r)) return "gold above what this run could loot";
  if (r.gold_total > r.gold_base) return "gold total above gold looted"; // no gold bonuses exist (yet)
  return null;
}
// New skins in a save must be covered by this run: one free skin per 5 waves (wave unlocks always give the
// cheapest skin you don't own, so the free ones are counted as the cheapest added), the rest paid with run gold.
export function skinsProblem(added: string[], r: Run | null): string | null {
  if (!added.length) return null;
  if (!r) return "new skins need a run";
  const prices = added.map((s) => SKIN_PRICES[s] ?? 1e9).sort((a, b) => a - b);
  const paid = prices.slice(Math.floor(r.wave / 5)).reduce((a, b) => a + b, 0);
  return paid > r.gold_total ? "skins cost more than this run's gold" : null;
}
