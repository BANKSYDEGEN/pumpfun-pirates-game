// PUMPFUN PIRATES · Supabase Edge Function: verify-score  (NOT deployed; see README "Wallet verification")
// Verifies a Phantom signMessage proof (ed25519, Sign-In-With-Solana style text) and inserts the score
// with verified = true. View-only: the message is plain text, it can't move funds, and this function never
// builds, requests or relays any transaction.
//
// Deploy (when you're ready):  supabase functions deploy verify-score --no-verify-jwt
// Needs the default secrets SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (set automatically by Supabase),
// and optionally ALLOWED_ORIGINS (comma-separated, default https://game.pumpfunpirates.com,https://banksydegen.github.io + itch.io HTML hosts html-classic.itch.zone, html.itch.zone).
import nacl from "npm:tweetnacl@1.0.3";
import bs58 from "npm:bs58@6.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://game.pumpfunpirates.com,https://banksydegen.github.io,https://html-classic.itch.zone,https://html.itch.zone")
  .split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
const MAX_AGE_MS = 24 * 3600 * 1000;
const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SEED_RE = /^\d{4}-\d{2}-\d{2}$/;
// must match js/walletVerify.js buildMessage() exactly
const STATEMENT = [
  "Sign in to PUMPFUN PIRATES to verify your leaderboard scores.",
  "View-only: this proves you own this wallet. It cannot move funds or approve any transaction.",
];

let cors: Record<string, string> = {};
const corsFor = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
// daily seeds: same rule as migration 002 (today's or yesterday's UTC day), since the service role skips RLS
const utcDay = (offset = 0) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);

// Parse + check the SIWS-style message the game builds in js/walletVerify.js buildMessage().
export function checkMessage(message: string, wallet: string, now = Date.now()): string | null {
  const lines = message.split("\n");
  if (message.length > 1000 || lines.length !== 11 || lines[2] !== "" || lines[5] !== "") return "bad format";
  const origin = ALLOWED_ORIGINS.find((o) => lines[0] === `${new URL(o).host} wants you to sign in with your Solana account:`);
  if (!origin) return "wrong domain";
  if (lines[1] !== wallet) return "wallet mismatch";
  const field = (k: string) => lines.find((l) => l.startsWith(`${k}: `))?.slice(k.length + 2);
  const uri = field("URI"), nonce = field("Nonce"), issued = field("Issued At");
  if (!uri || (uri !== origin && !uri.startsWith(origin + "/"))) return "wrong uri";
  if (lines[7] !== "Version: 1" || lines[8] !== "Chain ID: mainnet") return "bad format";
  if (!nonce || !/^[0-9a-f]{32}$/.test(nonce)) return "bad nonce";
  const t = Date.parse(issued ?? "");
  if (!Number.isFinite(t) || t > now + 5 * 60 * 1000 || now - t > MAX_AGE_MS) return "expired";
  if (lines[3] !== STATEMENT[0] || lines[4] !== STATEMENT[1]) return "unexpected text"; // the statement is fixed, word for word
  return null;
}

export function verifySignature(message: string, signatureB64: string, wallet: string): boolean {
  try {
    const sig = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
    const pub = bs58.decode(wallet);
    if (sig.length !== 64 || pub.length !== 32) return false;
    return nacl.sign.detached.verify(new TextEncoder().encode(message), sig, pub);
  } catch { return false; }
}

if (import.meta.main) Deno.serve(async (req) => {
  cors = corsFor(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "POST only" });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(400, { error: "bad json" }); }

  const wallet = String(b.wallet ?? ""), message = String(b.message ?? ""), signature = String(b.signature ?? "");
  if (!WALLET_RE.test(wallet)) return json(400, { error: "bad wallet" });
  const why = checkMessage(message, wallet);
  if (why) return json(401, { error: why });
  if (!verifySignature(message, signature, wallet)) return json(401, { error: "bad signature" });

  const int = (v: unknown, lo: number, hi: number) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
  const score = int(b.score, 0, 1_000_000), wave = int(b.wave, 1, 500), sunk = int(b.sunk, 0, 5000);
  const duration_s = b.duration_s == null ? null : int(b.duration_s, 0, 86400);
  if (score === null || wave === null || sunk === null) return json(400, { error: "bad score" });
  const name = b.name == null ? null : String(b.name).replace(/[<>&"`\\]/g, "").trim().slice(0, 20) || null;
  const row: Record<string, unknown> = { wallet, name, score, wave, sunk, duration_s, verified: true };
  if (b.mode === "daily") { const seed = String(b.seed ?? ""); if (!SEED_RE.test(seed) || (seed !== utcDay(0) && seed !== utcDay(1))) return json(400, { error: "bad seed" }); row.mode = "daily"; row.seed = seed; }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { error } = await db.from("scores").insert(row);
  if (error) return json(400, { error: error.message });
  return json(200, { ok: true, verified: true });
});
