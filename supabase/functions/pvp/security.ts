// PUMPFUN PIRATES · `pvp` Edge Function security helpers (SECURITY_FIXES.md). Pure functions: imported by index.ts,
// accounts.ts and security_test.ts. Nothing here touches the database.

// ---------- client IP (M3 / M2) ----------
// The first x-forwarded-for entry is whatever the CLIENT typed (spoofable). Order of trust:
//   1. TRUSTED_IP_HEADER (env, e.g. "cf-connecting-ip") when set: the one header the platform overwrites
//   2. cf-connecting-ip (Cloudflare sets it itself), 3. x-real-ip, 4. the LAST x-forwarded-for hop (added by the platform proxy)
export function trustedIp(h: Headers, envHeader?: string | null): string {
  const pick = (v: string | null) => (v ?? "").trim();
  if (envHeader) { const v = pick(h.get(envHeader)); if (v) return lastHop(v); }
  const cf = pick(h.get("cf-connecting-ip")); if (cf) return cf;
  const xr = pick(h.get("x-real-ip")); if (xr) return xr;
  const xff = pick(h.get("x-forwarded-for")); if (xff) return lastHop(xff);
  return "unknown";
}
const lastHop = (v: string) => { const parts = v.split(",").map((s) => s.trim()).filter(Boolean); return parts[parts.length - 1] || "unknown"; };

// ---------- Sign-In With Solana message (H4) ----------
// domain = the page host the request came from (must be in ALLOWED_ORIGINS), URI its origin. Phantom / Solflare check the
// domain line against the page that asks for the signature and warn / refuse on a mismatch, so a phishing site that relays
// our nonce gets a loud "this site is not game.pumpfunpirates.com" instead of a silent signature.
export const SIWS_STATEMENTS = {
  pvp: "Sign in to PUMPFUN PIRATES to save your Battle Royale progress. Read-only: this is not a transaction and cannot move funds.",
  airdrop: "Use this wallet as my PUMPFUN PIRATES airdrop wallet. Read-only: this is not a transaction and cannot move funds.",
} as const;
export function siwsMessage(o: { origin: string; wallet: string; nonce: string; issuedAt: string; expiresAt: string; statement: string; resources?: string[] }) {
  const u = new URL(o.origin);
  const lines = [
    `${u.host} wants you to sign in with your Solana account:`,
    o.wallet, "", o.statement.replace(/\n/g, " "), "",
    `URI: ${u.origin}`, "Version: 1", "Chain ID: mainnet", `Nonce: ${o.nonce}`, `Issued At: ${o.issuedAt}`, `Expiration Time: ${o.expiresAt}`,
  ];
  if (o.resources?.length) { lines.push("Resources:"); for (const r of o.resources) lines.push(`- ${r}`); }
  return lines.join("\n");
}
// the domain / expiry a stored SIWS message was issued for (null = not a SIWS message, e.g. an old pre-fix nonce)
export function siwsFacts(message: string): { host: string; uri: string; expires: number } | null {
  const m = /^([^\s]+) wants you to sign in with your Solana account:\n/.exec(message);
  const uri = /\nURI: ([^\n]+)/.exec(message)?.[1], exp = /\nExpiration Time: ([^\n]+)/.exec(message)?.[1];
  if (!m || !uri || !exp) return null;
  return { host: m[1], uri, expires: Date.parse(exp) };
}
// the allowed origin for this request: exact match only (no fallback to the first one for strangers)
export const allowedOrigin = (origin: string | null, allowed: string[]) => origin && allowed.includes(origin) ? origin : null;

// ---------- realtime tickets (M1 / H2) ----------
// Which channel a ticket is for. Arena 'pfp-pvp-<p>[sq]-<n>', harbor copy 'pfp-harbor[-<p>]-<n>', party 'pfp-party-<code>'.
// claimRooms = the `room` strings js/pvp.js puts in its kill claims from that channel (`${curPrefix()}-${roomIdx}`):
// in a harbor copy the claim uses the player's arena prefix (solo or squads) + the copy number.
export type Topic = { kind: "arena" | "harbor" | "party"; topic: string; prefix: string; n: number; claimRooms: string[]; live: boolean };
export function parseTopic(t: unknown): Topic | null {
  if (typeof t !== "string" || t.length > 60) return null;
  let m = /^(pfp-pvp-([a-zA-Z0-9]{1,16}))-([0-9]{1,2})$/.exec(t);
  if (m) return { kind: "arena", topic: t, prefix: m[1], n: +m[3], claimRooms: [t], live: /^pfp-pvp-v1(sq)?$/.test(m[1]) };
  m = /^(pfp-harbor(?:-([a-zA-Z0-9]{1,16}))?)-([0-9]{1,2})$/.exec(t);
  if (m) { const base = "pfp-pvp-" + (m[2] ?? "v1"), n = +m[3];
    return { kind: "harbor", topic: t, prefix: m[1], n, claimRooms: [`${base}-${n}`, `${base}sq-${n}`], live: !m[2] }; }
  m = /^pfp-party-([a-z0-9]{4,12})$/.exec(t);
  if (m) return { kind: "party", topic: t, prefix: "pfp-party", n: 0, claimRooms: [], live: true };
  return null;
}
const b64u = (s: string | Uint8Array) => {
  const bytes = typeof s === "string" ? new TextEncoder().encode(s) : s; let bin = ""; for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
// HS256 JWT for Supabase Realtime private channels (signed with the project's JWT secret, env PFP_RT_JWT_SECRET).
// role 'authenticated' so the realtime.messages RLS policies (migration 029) apply; pfp_topic / pfp_net bind it to one channel + id.
export async function mintJwt(secret: string, claims: Record<string, unknown>): Promise<string> {
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" })), body = b64u(JSON.stringify(claims));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${head}.${body}`)));
  return `${head}.${body}.${b64u(sig)}`;
}
// relay ticket (server/relay.js RELAY_TICKET_SECRET): "<net>.<topic-prefix>.<exp>.<hmac>" (HMAC-SHA256, base64url)
export async function relayTicket(secret: string, net: string, prefix: string, ttlS = 1800): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlS, data = `${net}.${prefix}.${exp}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return `${data}.${b64u(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data))))}`;
}
export const NET_RE = /^[a-z0-9]{6,20}$/;
// a lobby seat id is `${netId}${8 random}` (js/pvp.js seatId): the net id a seat proves
export const seatNetOk = (seat: string, net: string) => typeof seat === "string" && NET_RE.test(net) && seat.length >= net.length + 4 && seat.length <= 40 && seat.startsWith(net);
